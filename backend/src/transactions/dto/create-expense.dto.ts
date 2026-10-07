import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Largest amount one transaction can carry: the INTEGER column in satang (about 21.4 million baht). */
export const MAX_AMOUNT_SATANG = 2_000_000_000;

/** `YYYY-MM-DD` - a calendar date, no time and no zone (the column is a DATE). */
export const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class CreateExpenseDto {
  @IsUUID()
  yearAccountId!: string;

  @IsInt()
  @Min(2500)
  @Max(3000)
  academicYear!: number;

  /** Integer satang (data-dictionary.md 5): 125.50 baht is 12550. Never a float. */
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_SATANG)
  amountSatang!: number;

  @Matches(DATE_ONLY, { message: 'transactionDate must be a calendar date like 2026-10-05' })
  transactionDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
