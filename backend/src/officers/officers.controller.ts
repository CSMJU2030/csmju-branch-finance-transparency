import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CollectionResult } from '../common/api-response';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { GrantOfficerDto } from './dto/grant-officer.dto';
import { QueryOfficersDto } from './dto/query-officers.dto';
import { OfficersService } from './officers.service';

@Controller('v1/officer-assignments')
export class OfficersController {
  constructor(private readonly officers: OfficersService) {}

  /** What the caller holds: branch head? treasurer of which year accounts? */
  @Get('me')
  @RequirePermissions(Permission.OFFICER_READ_OWN)
  mine(@CurrentUser() user: CoreHubIdentity) {
    return this.officers.mine(user);
  }

  /** Current active student directory, fetched from Core Hub without local caching. */
  @Get('students')
  @Header('Cache-Control', 'no-store')
  @RequirePermissions(Permission.OFFICER_MANAGE)
  students(
    @CurrentUser() user: CoreHubIdentity,
    @CoreHubAccessToken() token: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('entryYear') entryYear?: string,
  ) {
    const parsedPage = page ? Number(page) : 1;
    const parsedEntryYear = entryYear ? Number(entryYear) : undefined;
    return this.officers.listAssignableStudents(user, token, { q, page: parsedPage, entryYear: parsedEntryYear });
  }

  /** Cohort labels needed only by a caller authorized to manage offices. */
  @Get('year-accounts')
  @RequirePermissions(Permission.OFFICER_MANAGE)
  yearAccounts(@CurrentUser() user: CoreHubIdentity) {
    return this.officers.listAssignableYearAccounts(user);
  }

  @Get()
  @RequirePermissions(Permission.OFFICER_READ_ANY)
  async list(@CurrentUser() user: CoreHubIdentity, @Query() query: QueryOfficersDto) {
    const { items, total } = await this.officers.list(user, query);
    return new CollectionResult(items, buildPaginationMeta(total, query.page ?? 1, query.take));
  }

  @Post()
  @RequirePermissions(Permission.OFFICER_MANAGE)
  grant(
    @CurrentUser() user: CoreHubIdentity,
    @Body() dto: GrantOfficerDto,
    @CoreHubAccessToken() token: string,
  ) {
    return this.officers.grant(user, dto, token);
  }

  @Patch(':id/revoke')
  @RequirePermissions(Permission.OFFICER_MANAGE)
  revoke(
    @CurrentUser() user: CoreHubIdentity,
    @Param('id', ParseUUIDPipe) id: string,
    @CoreHubAccessToken() token: string,
  ) {
    return this.officers.revoke(user, id, token);
  }
}
