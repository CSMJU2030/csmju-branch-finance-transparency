import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  yearAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  academicYear?: string;
}
