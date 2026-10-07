import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { AppException } from '../common/errors';
import { AdvanceAcademicYearDto } from './dto/advance-academic-year.dto';
import { QueryYearAccountsDto } from './dto/query-year-accounts.dto';
import { YearAccountsService } from './year-accounts.service';

@Controller('v1/year-accounts')
export class YearAccountsController {
  constructor(private readonly yearAccounts: YearAccountsService) {}

  @Get()
  @RequirePermissions(Permission.YEAR_ACCOUNT_READ)
  list(@Query() query: QueryYearAccountsDto) {
    return this.yearAccounts.listAll(query.includeArchived === 'true');
  }

  @Get(':id/summary')
  @RequirePermissions(Permission.YEAR_ACCOUNT_READ)
  summary(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('academicYear') academicYear: string | undefined,
    @CoreHubAccessToken() token: string,
  ) {
    const year = academicYear === undefined ? undefined : Number(academicYear);
    if (year !== undefined && (!Number.isInteger(year) || year < 2500 || year > 3000)) {
      throw AppException.badRequest('academicYear must be a valid Buddhist calendar year');
    }
    return this.yearAccounts.getSummary(id, year, token);
  }

  /** Once-a-year and hard to undo: the caller names the academic year explicitly. */
  @Post('advance-academic-year')
  @RequirePermissions(Permission.YEAR_ACCOUNT_ADVANCE)
  advance(
    @CurrentUser() user: CoreHubIdentity,
    @Body() dto: AdvanceAcademicYearDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.yearAccounts.advanceAcademicYear(user, dto.newAcademicYear, token);
  }
}
