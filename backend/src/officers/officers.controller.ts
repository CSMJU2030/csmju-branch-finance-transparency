import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
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
