import { HttpStatus, Injectable } from '@nestjs/common';
import { OfficerAssignment, OfficerRole, Prisma } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { AppException, ErrorCode } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../shared/transaction-lock';
import { GrantOfficerDto } from './dto/grant-officer.dto';
import { QueryOfficersDto } from './dto/query-officers.dto';
import { OfficerScopeService } from './officer-scope.service';

/**
 * Who holds which office (Layer 2: treasurer of a cohort, branch head). The subsystem's
 * own data keyed by Core Hub `core_user_id`; there is no local user table.
 *
 * Appointing rules - they exist so that nobody can decide on money they put themselves
 * in a position to decide on:
 *  - a Core Hub ADMIN appoints branch heads and treasurers;
 *  - a branch head appoints and releases treasurers, not other branch heads;
 *  - nobody appoints themselves;
 *  - one person never holds both offices at once (filing and deciding stay apart).
 */
@Injectable()
export class OfficersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficerScopeService,
    private readonly audit: AuditService,
    private readonly people: PeopleService,
  ) {}

  /** What the caller holds - the frontend uses it to show or hide actions. */
  async mine(user: CoreHubIdentity) {
    const assignments = await this.scope.activeAssignments(user.id);
    return {
      isBranchHead: assignments.some((a) => a.officerRole === OfficerRole.BRANCH_HEAD),
      treasurerYearAccountIds: assignments.flatMap((a) =>
        a.officerRole === OfficerRole.TREASURER && a.yearAccountId ? [a.yearAccountId] : [],
      ),
      assignments,
    };
  }

  async list(user: CoreHubIdentity, query: QueryOfficersDto) {
    await this.assertMayManage(user, undefined);

    const where: Prisma.OfficerAssignmentWhereInput = {
      officerRole: query.officerRole,
      yearAccountId: query.yearAccountId,
      ...(query.active === 'true' ? { activeTo: null } : {}),
      ...(query.active === 'false' ? { activeTo: { not: null } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.officerAssignment.findMany({
        where,
        orderBy: [{ activeTo: { sort: 'asc', nulls: 'first' } }, { activeFrom: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.officerAssignment.count({ where }),
    ]);
    return { items, total };
  }

  async grant(user: CoreHubIdentity, dto: GrantOfficerDto, token: string): Promise<OfficerAssignment> {
    await this.assertMayManage(user, dto.officerRole);

    if (dto.coreUserId === user.id) {
      throw AppException.forbidden('Nobody can appoint themselves');
    }
    if (dto.officerRole === OfficerRole.TREASURER && !dto.yearAccountId) {
      throw this.invalid('yearAccountId is required for a TREASURER');
    }
    if (dto.officerRole === OfficerRole.BRANCH_HEAD && dto.yearAccountId) {
      throw this.invalid('yearAccountId must not be set for a BRANCH_HEAD');
    }

    if (dto.yearAccountId) {
      const year = await this.prisma.yearAccount.findUnique({ where: { id: dto.yearAccountId } });
      if (!year || !year.active) {
        throw AppException.notFound('Year account not found');
      }
    }

    const holding = await this.scope.activeAssignments(dto.coreUserId);
    if (holding.some((a) => a.officerRole !== dto.officerRole)) {
      throw AppException.conflict('This person already holds the other office - one person cannot hold both');
    }

    const actorPersonCode = await this.people.myPersonCode(token);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.officerAssignment.create({
          data: {
            coreUserId: dto.coreUserId,
            personCode: dto.personCode ?? null,
            officerRole: dto.officerRole,
            yearAccountId: dto.yearAccountId ?? null,
            grantedByCoreUserId: user.id,
          },
        });
        await this.audit.record(
          {
            actorCoreUserId: user.id,
            actorPersonCode,
            action: 'OFFICER_GRANTED',
            targetType: 'OfficerAssignment',
            targetId: created.id,
            yearAccountId: created.yearAccountId,
            afterJson: {
              coreUserId: created.coreUserId,
              officerRole: created.officerRole,
              yearAccountId: created.yearAccountId,
            },
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppException.conflict('That office is already held by someone');
      }
      throw error;
    }
  }

  async revoke(user: CoreHubIdentity, id: string, token: string): Promise<OfficerAssignment> {
    const existing = await this.prisma.officerAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('Officer assignment not found');
    }
    await this.assertMayManage(user, existing.officerRole);

    const actorPersonCode = await this.people.myPersonCode(token);

    return this.prisma.$transaction(async (tx) => {
      // Conditional on activeTo = null so two concurrent revokes cannot both win.
      const { count } = await tx.officerAssignment.updateMany({
        where: { id, activeTo: null },
        data: { activeTo: new Date() },
      });
      if (count === 0) {
        throw AppException.conflict('This assignment has already ended');
      }
      const revoked = await tx.officerAssignment.findUniqueOrThrow({ where: { id } });
      await this.audit.record(
        {
          actorCoreUserId: user.id,
          actorPersonCode,
          action: 'OFFICER_REVOKED',
          targetType: 'OfficerAssignment',
          targetId: id,
          yearAccountId: revoked.yearAccountId,
          beforeJson: { coreUserId: revoked.coreUserId, officerRole: revoked.officerRole, active: true },
          afterJson: { active: false },
        },
        tx,
      );
      return revoked;
    });
  }

  /**
   * ADMIN may manage any office; a STUDENT caller must be the branch head, and only
   * treasurers are theirs to manage. `role` is undefined for a plain listing.
   */
  private async assertMayManage(user: CoreHubIdentity, role: OfficerRole | undefined): Promise<void> {
    if (user.subsystemRole === SubsystemRole.ADMIN) {
      return;
    }
    if (user.subsystemRole === SubsystemRole.STUDENT && (await this.scope.isBranchHead(user.id))) {
      if (role === undefined || role === OfficerRole.TREASURER) {
        return;
      }
    }
    throw AppException.forbidden('You cannot manage this office');
  }

  private invalid(message: string): AppException {
    return new AppException(ErrorCode.VALIDATION_ERROR, 'Validation failed', HttpStatus.BAD_REQUEST, [message]);
  }
}
