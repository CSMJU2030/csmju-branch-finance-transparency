import { Injectable } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { AppException } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import { OfficerScopeService } from '../officers/officer-scope.service';
import { PrismaService } from '../prisma/prisma.service';

/** Whole satang in, whole satang out: no floating point anywhere near money. */
export function calculateBalanceSatang(opening: number, approvedIncome: number, approvedExpense: number): number {
  return opening + approvedIncome - approvedExpense;
}

@Injectable()
export class YearAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficerScopeService,
    private readonly audit: AuditService,
    private readonly people: PeopleService,
  ) {}

  listAll(includeArchived: boolean) {
    return this.prisma.yearAccount.findMany({
      where: includeArchived ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { yearLevel: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        yearLevel: true,
        name: true,
        entryAcademicYearLabel: true,
        currency: true,
        active: true,
      },
      // openingBalanceSatang is left out on purpose: the balance is a derived figure
      // (see getSummary) and the raw opening column invites treating it as "the balance".
    });
  }

  /**
   * Balance = opening + APPROVED income - APPROVED expense. PENDING, REJECTED,
   * NEEDS_REVIEW and CANCELLED never count; VOIDED does not either, by
   * construction (voiding moves the row out of APPROVED). Archived cohorts can be
   * read too, so a graduated cohort's books stay open to inspection.
   */
  async getSummary(yearAccountId: string) {
    const year = await this.prisma.yearAccount.findUnique({ where: { id: yearAccountId } });
    if (!year) {
      throw AppException.notFound('Year account not found');
    }

    const sum = (type: TransactionType, status: TransactionStatus) =>
      this.prisma.transaction.aggregate({
        where: { yearAccountId, type, status },
        _sum: { amountSatang: true },
      });
    const [income, expense, pendingExpense, periods] = await Promise.all([
      sum(TransactionType.INCOME, TransactionStatus.APPROVED),
      sum(TransactionType.EXPENSE, TransactionStatus.APPROVED),
      // Display only: what is still waiting, so a reviewer sees it before deciding. It never
      // blocks anything (confirmed rule: no hard cap on spending).
      sum(TransactionType.EXPENSE, TransactionStatus.PENDING),
      this.prisma.yearLevelPeriod.findMany({
        where: { yearAccountId },
        orderBy: { startedAt: 'asc' },
        select: { academicYear: true, yearLevel: true, startedAt: true, endedAt: true, closingBalanceSatang: true },
      }),
    ]);

    const approvedIncomeSatang = income._sum.amountSatang ?? 0;
    const approvedExpenseSatang = expense._sum.amountSatang ?? 0;

    return {
      yearAccountId: year.id,
      yearLevel: year.yearLevel,
      name: year.name,
      currency: year.currency,
      active: year.active,
      openingBalanceSatang: year.openingBalanceSatang,
      approvedIncomeSatang,
      approvedExpenseSatang,
      balanceSatang: calculateBalanceSatang(year.openingBalanceSatang, approvedIncomeSatang, approvedExpenseSatang),
      pendingExpenseTotalSatang: pendingExpense._sum.amountSatang ?? 0,
      periods,
    };
  }

  /**
   * Once per academic year, the branch head or an admin: every active cohort moves up one
   * level, the year-4 cohort graduates (archived, history kept) and a new year-1
   * cohort is created. Archiving year 4 first - the order is DESC - keeps the
   * partial unique index on (year_level WHERE active) from rejecting year 3 -> 4.
   *
   * SERIALIZABLE: this is a rare, hard-to-undo operation, and two requests for the
   * same academic year must not both pass the "already advanced" check.
   */
  async advanceAcademicYear(user: CoreHubIdentity, newAcademicYear: string, token: string) {
    await this.scope.assertMayDecide(user);
    const personCode = await this.people.myPersonCode(token);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (await tx.yearLevelPeriod.findFirst({ where: { academicYear: newAcademicYear } })) {
            throw AppException.conflict(`Academic year ${newAcademicYear} has already been advanced to`);
          }

          const cohorts = await tx.yearAccount.findMany({ where: { active: true }, orderBy: { yearLevel: 'desc' } });
          let graduatedCount = 0;
          let promotedCount = 0;

          for (const cohort of cohorts) {
            const [income, expense] = await Promise.all([
              tx.transaction.aggregate({
                where: { yearAccountId: cohort.id, type: 'INCOME', status: 'APPROVED' },
                _sum: { amountSatang: true },
              }),
              tx.transaction.aggregate({
                where: { yearAccountId: cohort.id, type: 'EXPENSE', status: 'APPROVED' },
                _sum: { amountSatang: true },
              }),
            ]);
            const closing = calculateBalanceSatang(
              cohort.openingBalanceSatang,
              income._sum.amountSatang ?? 0,
              expense._sum.amountSatang ?? 0,
            );

            await tx.yearLevelPeriod.updateMany({
              where: { yearAccountId: cohort.id, endedAt: null },
              data: { endedAt: new Date(), closingBalanceSatang: closing },
            });

            if (cohort.yearLevel >= 4) {
              await tx.yearAccount.update({ where: { id: cohort.id }, data: { active: false } });
              graduatedCount += 1;
            } else {
              const level = cohort.yearLevel + 1;
              await tx.yearAccount.update({ where: { id: cohort.id }, data: { yearLevel: level } });
              await tx.yearLevelPeriod.create({
                data: { yearAccountId: cohort.id, academicYear: newAcademicYear, yearLevel: level },
              });
              promotedCount += 1;
            }
          }

          const created = await tx.yearAccount.create({
            data: {
              yearLevel: 1,
              name: `Year 1 (${newAcademicYear})`,
              entryAcademicYearLabel: newAcademicYear,
              openingBalanceSatang: 0,
            },
          });
          await tx.yearLevelPeriod.create({
            data: { yearAccountId: created.id, academicYear: newAcademicYear, yearLevel: 1 },
          });

          await this.audit.record(
            {
              actorCoreUserId: user.id,
              actorPersonCode: personCode,
              action: 'ADVANCE_ACADEMIC_YEAR',
              targetType: 'AcademicYear',
              targetId: created.id, // no better single target: this is a branch-wide event
              afterJson: { newAcademicYear, graduatedCount, promotedCount, newCohortId: created.id },
            },
            tx,
          );
          return { newAcademicYear, graduatedCount, promotedCount, newYear1CohortId: created.id };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // 40001 surfaces as P2034: another advance (or a write it conflicts with) won.
      if ((error as { code?: string }).code === 'P2034') {
        throw AppException.conflict('The academic year is being advanced by someone else - try again');
      }
      throw error;
    }
  }
}
