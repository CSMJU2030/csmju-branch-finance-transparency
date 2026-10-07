import { Injectable } from '@nestjs/common';
import { Transaction, TransactionStatus, TransactionType } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { AppException } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import { ReferenceDataService } from '../core-hub/reference-data.service';
import { OfficerScopeService } from '../officers/officer-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { lockTransaction } from '../shared/transaction-lock';
import { RejectTransactionDto } from './dto/reject-transaction.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';

type Decision = 'APPROVE' | 'REJECT' | 'VOID';

interface Transition {
  user: CoreHubIdentity;
  token: string;
  transactionId: string;
  decision: Decision;
  /** Status the row must be in. Which one depends on type, so it is a function of the row. */
  from: (row: Transaction) => TransactionStatus;
  to: TransactionStatus;
  reason?: string;
  /** Restrict to one transaction type (approve = EXPENSE, confirm-income = INCOME). */
  onlyType?: TransactionType;
  recordApprover: boolean;
}

/**
 * The decisions: approve, reject, void, confirm income. Allowed to the branch head (a
 * student holding that office) and to admins; OfficerScopeService.assertMayDecide checks
 * it against real data. What else stays here is segregation of duties: nobody decides on
 * an entry they filed themselves.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficerScopeService,
    private readonly audit: AuditService,
    private readonly people: PeopleService,
    private readonly referenceData: ReferenceDataService,
  ) {}

  /**
   * Everything waiting for a decision: PENDING expenses and NEEDS_REVIEW income.
   * Oldest first - the longest-waiting request is the one to read next.
   */
  async listPending(user: CoreHubIdentity, academicYear?: number, token?: string): Promise<Transaction[]> {
    await this.scope.assertMayDecide(user);
    const range = academicYear === undefined ? null : await this.referenceData.academicYearRange(token!, academicYear);
    return this.prisma.transaction.findMany({
      where: {
        ...(range ? { transactionDate: { gte: new Date(range.startDate), lte: new Date(range.endDate) } } : {}),
        OR: [
          { status: TransactionStatus.PENDING, type: TransactionType.EXPENSE },
          { status: TransactionStatus.NEEDS_REVIEW, type: TransactionType.INCOME },
        ],
      },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  approve(user: CoreHubIdentity, transactionId: string, token: string) {
    return this.transition({
      user,
      token,
      transactionId,
      decision: 'APPROVE',
      from: () => TransactionStatus.PENDING,
      to: TransactionStatus.APPROVED,
      onlyType: TransactionType.EXPENSE,
      recordApprover: true,
    });
  }

  /** Income arrives NEEDS_REVIEW; confirming it is what makes it count toward the balance. */
  confirmIncome(user: CoreHubIdentity, transactionId: string, token: string) {
    return this.transition({
      user,
      token,
      transactionId,
      decision: 'APPROVE',
      from: () => TransactionStatus.NEEDS_REVIEW,
      to: TransactionStatus.APPROVED,
      onlyType: TransactionType.INCOME,
      recordApprover: true,
    });
  }

  /** Reject works the same for both types; it just starts from a different "undecided" status. */
  reject(user: CoreHubIdentity, transactionId: string, dto: RejectTransactionDto, token: string) {
    return this.transition({
      user,
      token,
      transactionId,
      decision: 'REJECT',
      from: (row) => (row.type === TransactionType.EXPENSE ? TransactionStatus.PENDING : TransactionStatus.NEEDS_REVIEW),
      to: TransactionStatus.REJECTED,
      reason: dto.reason,
      recordApprover: false,
    });
  }

  /** Reverses an already APPROVED transaction (a PENDING one is rejected instead). */
  void(user: CoreHubIdentity, transactionId: string, dto: VoidTransactionDto, token: string) {
    return this.transition({
      user,
      token,
      transactionId,
      decision: 'VOID',
      from: () => TransactionStatus.APPROVED,
      to: TransactionStatus.VOIDED,
      reason: dto.reason,
      recordApprover: false,
    });
  }

  private async transition(t: Transition): Promise<Transaction> {
    await this.scope.assertMayDecide(t.user);
    const personCode = await this.people.myPersonCode(t.token);

    return this.prisma.$transaction(async (tx) => {
      // Serialises with every concurrent edit / cancel / approve / bill upload of this row.
      await lockTransaction(tx, t.transactionId);
      const row = await tx.transaction.findUnique({ where: { id: t.transactionId } });

      if (!row) {
        throw AppException.notFound('Transaction not found');
      }
      if (t.onlyType && row.type !== t.onlyType) {
        throw AppException.conflict(`Transaction is type ${row.type}, not ${t.onlyType}`);
      }
      const fromStatus = t.from(row);
      if (row.status !== fromStatus) {
        throw AppException.conflict(
          `Transaction is ${row.status}, not ${fromStatus} - cannot ${t.decision.toLowerCase()} it`,
        );
      }
      // Segregation of duties: nobody decides on their own entry.
      if (row.createdByCoreUserId === t.user.id) {
        throw AppException.forbidden('You cannot act on a transaction you filed yourself');
      }
      // Business rule 4.2: an expense needs a bill before it can be approved. Checked inside
      // the lock, so a bill cannot be swapped out between check and write. Income may be
      // confirmed with or without evidence (a deposit slip is welcome, not required).
      if (t.decision === 'APPROVE' && row.type === TransactionType.EXPENSE) {
        const bills = await tx.expenseEvidence.count({ where: { transactionId: row.id, isCurrent: true } });
        if (bills === 0) {
          throw AppException.conflict('This expense has no bill attached and cannot be approved');
        }
      }

      const updated = await tx.transaction.update({
        where: { id: row.id },
        data: {
          status: t.to,
          ...(t.recordApprover
            ? { approvedByCoreUserId: t.user.id, approvedByPersonCode: personCode, approvedAt: new Date() }
            : {}),
        },
      });
      await tx.approvalAction.create({
        data: {
          transactionId: row.id,
          decision: t.decision,
          reason: t.reason,
          actorCoreUserId: t.user.id,
          actorPersonCode: personCode,
        },
      });
      await this.audit.record(
        {
          actorCoreUserId: t.user.id,
          actorPersonCode: personCode,
          action: this.auditAction(t.decision, row.type),
          targetType: 'Transaction',
          targetId: row.id,
          yearAccountId: row.yearAccountId,
          beforeJson: { status: row.status },
          afterJson: { status: updated.status },
          metadataJson: t.reason ? { reason: t.reason } : undefined,
        },
        tx,
      );
      return updated;
    });
  }

  private auditAction(decision: Decision, type: TransactionType): string {
    if (decision === 'APPROVE') {
      return type === TransactionType.INCOME ? 'INCOME_CONFIRMED' : 'TRANSACTION_APPROVED';
    }
    return decision === 'REJECT' ? 'TRANSACTION_REJECTED' : 'VOID_TRANSACTION';
  }
}
