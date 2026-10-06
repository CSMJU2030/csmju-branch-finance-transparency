import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AdvanceAcademicYearDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, { message: 'newAcademicYear should be a 4-digit year label, e.g. "2569".' })
  newAcademicYear!: string;
}
