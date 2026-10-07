import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { AppException } from '../common/errors';
import { ApprovalsService } from './approvals.service';
import { RejectTransactionDto } from './dto/reject-transaction.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';

/**
 * Role-level permission here (student, admin); the branch-head office is checked in the
 * service (OfficerScopeService.assertMayDecide): see src/auth/permissions.ts.
 */
@Controller('v1')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get('approvals/pending')
  @RequirePermissions(Permission.APPROVAL_READ)
  listPending(
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
    @Query('academicYear') academicYear?: string,
  ) {
    const year = academicYear === undefined ? undefined : Number(academicYear);
    if (year !== undefined && (!Number.isInteger(year) || year < 2500 || year > 3000)) {
      throw AppException.badRequest('academicYear must be a valid Buddhist calendar year');
    }
    return this.approvals.listPending(user, year, token);
  }

  @Patch('transactions/:id/approve')
  @RequirePermissions(Permission.TRANSACTION_APPROVE)
  approve(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @CoreHubAccessToken() token: string,
  ) {
    return this.approvals.approve(user, id, token);
  }

  @Patch('transactions/:id/confirm-income')
  @RequirePermissions(Permission.INCOME_CONFIRM)
  confirmIncome(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @CoreHubAccessToken() token: string,
  ) {
    return this.approvals.confirmIncome(user, id, token);
  }

  @Patch('transactions/:id/reject')
  @RequirePermissions(Permission.TRANSACTION_REJECT)
  reject(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransactionDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.approvals.reject(user, id, dto, token);
  }

  @Patch('transactions/:id/void')
  @RequirePermissions(Permission.TRANSACTION_VOID)
  void_(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidTransactionDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.approvals.void(user, id, dto, token);
  }
}
