import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

export interface AuditEntry {
  /** Core Hub `sub` of whoever acted; null only for a system-originated event. */
  actorCoreUserId: string | null;
  /** From GET /people/me when the action happened - shown instead of a name. */
  actorPersonCode?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  yearAccountId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  metadataJson?: unknown;
}

const AUDIT_LOG_INCLUDE = {
  yearAccount: { select: { id: true, name: true, yearLevel: true } },
} satisfies Prisma.AuditLogInclude;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an audit row. Pass the surrounding Prisma transaction client so the
   * entry commits - or rolls back - together with the change it records: a
   * state change must never succeed without its audit entry, or the other way
   * round. The table itself is append-only (trigger in the migration).
   */
  async record(entry: AuditEntry, client: Pick<PrismaClient, 'auditLog'> = this.prisma): Promise<void> {
    await client.auditLog.create({
      data: {
        actorCoreUserId: entry.actorCoreUserId,
        actorPersonCode: entry.actorPersonCode ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        yearAccountId: entry.yearAccountId ?? null,
        beforeJson: (entry.beforeJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        afterJson: (entry.afterJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        metadataJson: (entry.metadataJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async list(query: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      targetType: query.targetType,
    };
    if (query.academicYear) {
      const periods = await this.prisma.yearLevelPeriod.findMany({
        where: { academicYear: query.academicYear },
        select: { yearAccountId: true, startedAt: true, endedAt: true },
      });
      where.AND = [
        {
          OR: periods.map((period) => ({
            createdAt: {
              gte: period.startedAt,
              ...(period.endedAt ? { lte: period.endedAt } : {}),
            },
          })),
        },
        ...(query.yearAccountId ? [{ yearAccountId: query.yearAccountId }] : []),
      ];
    } else {
      where.yearAccountId = query.yearAccountId;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: AUDIT_LOG_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }

  /** The decision trail of one record, oldest first: read as a narrative, not a feed. */
  listForTarget(targetType: string, targetId: string) {
    return this.prisma.auditLog.findMany({
      where: { targetType, targetId },
      include: AUDIT_LOG_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }
}
