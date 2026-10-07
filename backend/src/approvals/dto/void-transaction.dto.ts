import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidTransactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
