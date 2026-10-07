import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { CancelTransactionDto } from './dto/cancel-transaction.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('v1')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('transactions')
  @RequirePermissions(Permission.TRANSACTION_READ)
  async list(
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
    @Query() query: QueryTransactionsDto,
  ) {
    const { items, total } = await this.transactions.list(user, query, token);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Get('transactions/:id')
  @RequirePermissions(Permission.TRANSACTION_READ)
  getOne(@CurrentUser() user: CoreHubIdentity, @Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.getById(user, id);
  }

  @Post('expenses')
  @RequirePermissions(Permission.EXPENSE_CREATE)
  create(
    @CurrentUser() user: CoreHubIdentity,
    @Body() dto: CreateExpenseDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.transactions.createExpense(user, dto, token);
  }

  @Post('incomes')
  @RequirePermissions(Permission.INCOME_CREATE)
  createIncome(
    @CurrentUser() user: CoreHubIdentity,
    @Body() dto: CreateIncomeDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.transactions.createIncome(user, dto, token);
  }

  @Patch('transactions/:id')
  @RequirePermissions(Permission.TRANSACTION_UPDATE_OWN)
  update(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.transactions.updateTransaction(user, id, dto, token);
  }

  @Patch('transactions/:id/cancel')
  @RequirePermissions(Permission.TRANSACTION_CANCEL_OWN)
  cancel(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTransactionDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.transactions.cancelTransaction(user, id, dto, token);
  }
}
