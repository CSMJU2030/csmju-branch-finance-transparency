import { IsIn, IsOptional } from 'class-validator';

export class QueryYearAccountsDto {
  /** `true` also lists cohorts that already graduated (their history is kept). */
  @IsOptional()
  @IsIn(['true'])
  includeArchived?: 'true';
}
