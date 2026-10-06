import { Injectable } from '@nestjs/common';
import { OfficerAssignment, OfficerRole } from '../../generated/prisma/client';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { AppException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The service-layer half of authorization (authorization.md 4). The guard only checks
 * that the caller's ROLE holds a permission; whether this student actually holds the
 * OFFICE that permission is meant for is decided here, against real data - the same way
 * `:own` is.
 *
 *   TREASURER    active assignment for the year account being touched
 *   BRANCH_HEAD  active branch-wide assignment (an admin decides without one)
 *
 * The answer is always one plain 403, whatever the reason, so a response never tells a
 * caller which offices exist.
 */
@Injectable()
export class OfficerScopeService {
  constructor(private readonly prisma: PrismaService) {}

  activeAssignments(coreUserId: string): Promise<OfficerAssignment[]> {
    return this.prisma.officerAssignment.findMany({
      where: { coreUserId, activeTo: null },
      orderBy: { activeFrom: 'asc' },
    });
  }

  async isBranchHead(coreUserId: string): Promise<boolean> {
    const count = await this.prisma.officerAssignment.count({
      where: { coreUserId, officerRole: OfficerRole.BRANCH_HEAD, activeTo: null },
    });
    return count > 0;
  }

  /** Year accounts this person is the active treasurer of. */
  async treasurerYearAccountIds(coreUserId: string): Promise<string[]> {
    const rows = await this.prisma.officerAssignment.findMany({
      where: { coreUserId, officerRole: OfficerRole.TREASURER, activeTo: null },
      select: { yearAccountId: true },
    });
    return rows.flatMap((row) => (row.yearAccountId ? [row.yearAccountId] : []));
  }

  async assertTreasurerOf(user: CoreHubIdentity, yearAccountId: string): Promise<void> {
    const count = await this.prisma.officerAssignment.count({
      where: { coreUserId: user.id, officerRole: OfficerRole.TREASURER, yearAccountId, activeTo: null },
    });
    if (count === 0) {
      throw AppException.forbidden('Only the treasurer of this year account can do this');
    }
  }

  /** Deciding on money (approve, reject, void, audit, advance the year): the branch head or an admin. */
  async assertMayDecide(user: CoreHubIdentity): Promise<void> {
    if (user.subsystemRole === SubsystemRole.ADMIN) {
      return;
    }
    if (!(await this.isBranchHead(user.id))) {
      throw AppException.forbidden('Only the branch head can do this');
    }
  }
}
