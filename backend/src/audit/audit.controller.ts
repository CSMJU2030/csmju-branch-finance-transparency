import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OfficerScopeService } from '../officers/officer-scope.service';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/** Audit access is controlled by the AUDIT_READ role permission. */
@Controller('v1')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly scope: OfficerScopeService,
  ) {}

  @Get('audit-logs')
  @RequirePermissions(Permission.AUDIT_READ)
  async list(@CurrentUser() user: CoreHubIdentity, @Query() query: ListAuditLogsQueryDto) {
    await this.scope.assertMayReadAudit(user);
    const { items, total } = await this.audit.list(query);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get('transactions/:transactionId/audit')
  @RequirePermissions(Permission.AUDIT_READ)
  async forTransaction(
    @CurrentUser() user: CoreHubIdentity,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    await this.scope.assertMayReadAudit(user);
    return this.audit.listForTarget('Transaction', transactionId);
  }
}
