import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { OfficerRole } from '../../../generated/prisma/client';

export class GrantOfficerDto {
  /**
   * The person's Core Hub `sub`. Text, not a UUID (CSV-imported students are
   * `user-<code>`), so it is deliberately not validated as one.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^\S+$/, { message: 'coreUserId must not contain whitespace' })
  coreUserId!: string;

  @IsEnum(OfficerRole)
  officerRole!: OfficerRole;

  /** Required for both offices: the cohort/year the officer is appointed to care for. */
  @IsOptional()
  @IsUUID()
  yearAccountId?: string;

  /** Student code, so the list can show who this is without a name. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,50}$/, { message: 'personCode must be 1-50 letters, digits or hyphens' })
  personCode?: string;
}
