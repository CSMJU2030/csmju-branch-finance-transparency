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

/** The audit trail is for the deciders (branch head, admin): permission at role level, office in the service. */
@Controller('v1')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly scope: OfficerScopeService,
  ) {}

  @Get('audit-logs')
  @RequirePermissions(Permission.AUDIT_READ)
  async list(@CurrentUser() user: CoreHubIdentity, @Query() query: ListAuditLogsQueryDto) {
    await this.scope.assertMayDecide(user);
    const { items, total } = await this.audit.list(query);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get('transactions/:transactionId/audit')
  @RequirePermissions(Permission.AUDIT_READ)
  async forTransaction(
    @CurrentUser() user: CoreHubIdentity,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
  ) {
    await this.scope.assertMayDecide(user);
    return this.audit.listForTarget('Transaction', transactionId);
  }
}
