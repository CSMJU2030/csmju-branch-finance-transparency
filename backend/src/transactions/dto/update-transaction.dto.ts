import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DATE_ONLY, MAX_AMOUNT_SATANG } from './create-expense.dto';

export class UpdateTransactionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_SATANG)
  amountSatang?: number;

  @IsOptional()
  @Matches(DATE_ONLY, { message: 'transactionDate must be a calendar date like 2026-10-05' })
  transactionDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
