import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { TransactionStatus, TransactionType } from '../../../generated/prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryTransactionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  yearAccountId?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  /** `true` = only what the caller filed themselves. */
  @IsOptional()
  @IsIn(['true'])
  mine?: 'true';
}
