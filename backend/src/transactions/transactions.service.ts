import { Injectable } from '@nestjs/common';
import { Prisma, Transaction, TransactionStatus, TransactionType } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { AppException } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import { ReferenceDataService } from '../core-hub/reference-data.service';
import { OfficerScopeService } from '../officers/officer-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { lockTransaction } from '../shared/transaction-lock';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

/** The status an entry has before anyone has decided on it. */
export function undecidedStatus(type: TransactionType): TransactionStatus {
  return type === TransactionType.EXPENSE ? TransactionStatus.PENDING : TransactionStatus.NEEDS_REVIEW;
}

/**
 * Every write below follows the same shape: lock the row, read its status, check who is
 * asking, change it and write the audit entry - all in ONE database transaction. The lock
 * makes "check then change" safe against a concurrent approve / edit / cancel, and the
 * shared transaction means a state change can never exist without its audit entry (or the
 * reverse).
 *
 * Filing is the treasurer's: the role-level permission lets a student attempt it, and
 * OfficerScopeService then checks they are the active treasurer of that cohort.
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficerScopeService,
    private readonly audit: AuditService,
    private readonly people: PeopleService,
    private readonly referenceData: ReferenceDataService,
  ) {}

  /** A treasurer files an expense for their own cohort; it starts PENDING. */
  createExpense(user: CoreHubIdentity, dto: CreateExpenseDto, token: string): Promise<Transaction> {
    return this.create(user, dto, token, TransactionType.EXPENSE);
  }

  /** A treasurer files money received for their own cohort; it starts NEEDS_REVIEW. */
  createIncome(user: CoreHubIdentity, dto: CreateIncomeDto, token: string): Promise<Transaction> {
    return this.create(user, dto, token, TransactionType.INCOME);
  }

  private async create(
    user: CoreHubIdentity,
    dto: CreateExpenseDto,
    token: string,
    type: TransactionType,
  ): Promise<Transaction> {
    await this.scope.assertTreasurerOf(user, dto.yearAccountId);

    const year = await this.prisma.yearAccount.findUnique({ where: { id: dto.yearAccountId } });
    if (!year || !year.active) {
      throw AppException.notFound('Year account not found');
    }
    const [range, period] = await Promise.all([
      this.referenceData.academicYearRange(token, dto.academicYear),
      this.prisma.yearLevelPeriod.findUnique({
        where: { yearAccountId_academicYear: { yearAccountId: dto.yearAccountId, academicYear: String(dto.academicYear) } },
      }),
    ]);
    const transactionDate = new Date(dto.transactionDate);
    if (!period || dto.transactionDate < range.startDate || dto.transactionDate > range.endDate) {
      throw AppException.badRequest('The transaction date must fall within the selected academic year and assigned cohort period');
    }

    // Personal data is never cached: asked now, with the filer's own token.
    const personCode = await this.people.myPersonCode(token);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          yearAccountId: dto.yearAccountId,
          type,
          status: undecidedStatus(type),
          amountSatang: dto.amountSatang,
          transactionDate,
          description: dto.description,
          category: dto.category,
          sourceType: 'MANUAL',
          createdByCoreUserId: user.id,
          createdByPersonCode: personCode,
        },
      });
      await this.audit.record(
        {
          actorCoreUserId: user.id,
          actorPersonCode: personCode,
          action: `${type}_CREATED`,
          targetType: 'Transaction',
          targetId: created.id,
          yearAccountId: created.yearAccountId,
          afterJson: { status: created.status, amountSatang: created.amountSatang },
        },
        tx,
      );
      return created;
    });
  }

  /** Branch-wide read: transparency is the point, so every signed-in role sees every cohort. */
  async list(user: CoreHubIdentity, query: QueryTransactionsDto, token: string): Promise<{ items: Transaction[]; total: number }> {
    const range = query.academicYear ? await this.referenceData.academicYearRange(token, query.academicYear) : null;
    const where: Prisma.TransactionWhereInput = {
      yearAccountId: query.yearAccountId,
      ...(range ? { transactionDate: { gte: new Date(range.startDate), lte: new Date(range.endDate) } } : {}),
      type: query.type,
      status: query.status,
      ...(query.mine ? { createdByCoreUserId: user.id } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items: rows.map((row) => this.maskFor(user, row)), total };
  }

  async getById(user: CoreHubIdentity, id: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });
    if (!transaction) {
      throw AppException.notFound('Transaction not found');
    }
    return this.maskFor(user, transaction);
  }

  /** Only the creator, and only while it is still undecided; audited with before/after. */
  async updateTransaction(
    user: CoreHubIdentity,
    id: string,
    dto: UpdateTransactionDto,
    token: string,
  ): Promise<Transaction> {
    const hasChange = [dto.amountSatang, dto.transactionDate, dto.description, dto.category].some(
      (value) => value !== undefined,
    );
    if (!hasChange) {
      throw AppException.badRequest('Nothing to change');
    }
    const personCode = await this.people.myPersonCode(token);

    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoadOwnUndecided(tx, user, id, 'edited');

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...(dto.amountSatang !== undefined ? { amountSatang: dto.amountSatang } : {}),
          ...(dto.transactionDate !== undefined ? { transactionDate: new Date(dto.transactionDate) } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
        },
      });
      await this.audit.record(
        {
          actorCoreUserId: user.id,
          actorPersonCode: personCode,
          action: `${current.type}_UPDATED`,
          targetType: 'Transaction',
          targetId: id,
          yearAccountId: current.yearAccountId,
          beforeJson: this.snapshot(current),
          afterJson: this.snapshot(updated),
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * The creator withdraws their own still-undecided entry. A status change with a
   * mandatory reason, never a row deletion: the transaction, its bills and this entry
   * all stay (no hard delete of financial records).
   */
  async cancelTransaction(
    user: CoreHubIdentity,
    id: string,
    dto: CancelTransactionDto,
    token: string,
  ): Promise<Transaction> {
    const personCode = await this.people.myPersonCode(token);

    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockAndLoadOwnUndecided(tx, user, id, 'cancelled');

      const cancelled = await tx.transaction.update({
        where: { id },
        data: { status: TransactionStatus.CANCELLED },
      });
      await this.audit.record(
        {
          actorCoreUserId: user.id,
          actorPersonCode: personCode,
          action: `${current.type}_CANCELLED`,
          targetType: 'Transaction',
          targetId: id,
          yearAccountId: current.yearAccountId,
          beforeJson: { status: current.status },
          afterJson: { status: cancelled.status },
          metadataJson: { reason: dto.reason },
        },
        tx,
      );
      return cancelled;
    });
  }

  /**
   * Row lock, then: it exists, it is an expense or income, it is still undecided, the
   * caller filed it ("own") and is still the treasurer of that cohort. The order puts a
   * missing id and a wrong status ahead of the permission answer so each gets its own
   * honest error.
   */
  private async lockAndLoadOwnUndecided(
    tx: Prisma.TransactionClient,
    user: CoreHubIdentity,
    id: string,
    verb: 'edited' | 'cancelled',
  ): Promise<Transaction> {
    await lockTransaction(tx, id);
    const current = await tx.transaction.findUnique({ where: { id } });

    if (!current) {
      throw AppException.notFound('Transaction not found');
    }
    if (current.type !== TransactionType.EXPENSE && current.type !== TransactionType.INCOME) {
      throw AppException.conflict(`An ${current.type} entry cannot be ${verb} here`);
    }
    if (current.status !== undecidedStatus(current.type)) {
      throw AppException.conflict(`A ${current.status} transaction can no longer be ${verb}`);
    }
    if (current.createdByCoreUserId !== user.id) {
      throw AppException.forbidden('Only the treasurer who filed this entry can change it');
    }
    // Still the treasurer of that cohort? (A new treasurer takes over their drafts.)
    const stillTreasurer = await tx.officerAssignment.count({
      where: { coreUserId: user.id, officerRole: 'TREASURER', yearAccountId: current.yearAccountId, activeTo: null },
    });
    if (stillTreasurer === 0) {
      throw AppException.forbidden('Only the treasurer of this year account can do this');
    }
    return current;
  }

  /** Business rule 10: bank reference details are not for students. */
  private maskFor<T extends { externalReference: string | null }>(user: CoreHubIdentity, row: T): T {
    return user.subsystemRole === SubsystemRole.STUDENT ? { ...row, externalReference: null } : row;
  }

  private snapshot(row: Transaction) {
    return {
      amountSatang: row.amountSatang,
      transactionDate: row.transactionDate.toISOString().slice(0, 10),
      description: row.description,
      category: row.category,
    };
  }
}
