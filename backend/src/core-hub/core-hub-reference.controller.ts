import { Controller, Get } from '@nestjs/common';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { ReferenceDataService } from './reference-data.service';

@Controller('v1/core-hub')
export class CoreHubReferenceController {
  constructor(private readonly referenceData: ReferenceDataService) {}

  /** Four newest academic years from Core Hub reference data. */
  @Get('academic-years')
  @RequirePermissions(Permission.YEAR_ACCOUNT_READ)
  recentAcademicYears(@CoreHubAccessToken() token: string) {
    return this.referenceData.recentAcademicYears(token);
  }

  /** Current academic year from Core Hub reference data. */
  @Get('academic-terms/current')
  @RequirePermissions(Permission.YEAR_ACCOUNT_READ)
  async currentAcademicTerm(@CoreHubAccessToken() token: string) {
    const term = await this.referenceData.currentAcademicTerm(token);
    if (!term) return null;
    return {
      academicYear: term.academicYear,
    };
  }
}
