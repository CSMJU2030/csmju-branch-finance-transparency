import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { OfficerRole } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryOfficersDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OfficerRole)
  officerRole?: OfficerRole;

  @IsOptional()
  @IsUUID()
  yearAccountId?: string;

  /** `true` = current officers only, `false` = past ones only, absent = both. */
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';
}
