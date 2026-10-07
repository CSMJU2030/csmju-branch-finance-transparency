import { Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { CoreHubAccessToken } from '../auth/decorators/core-hub-access-token.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { MAX_IMAGE_BYTES } from '../images/image-type';
import { EvidenceService } from './evidence.service';

@Controller('v1/transactions/:transactionId/evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get()
  @RequirePermissions(Permission.EVIDENCE_READ)
  list(@Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.evidence.list(transactionId);
  }

  /** multipart/form-data, field `file`: PDF, JPEG, PNG or WebP up to 10 MB. */
  @Post()
  @RequirePermissions(Permission.EVIDENCE_CREATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  upload(
    @CurrentUser() user: CoreHubIdentity,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CoreHubAccessToken() token: string,
  ) {
    return this.evidence.upload(user, transactionId, file, token);
  }
}

/**
 * A bill kept in this database (a PDF), by its own id: a flat route, because the standard
 * allows one level of nesting at most (api-conventions.md 2) and the evidence id is enough.
 */
@Controller('v1/evidence')
export class EvidenceFilesController {
  constructor(private readonly evidence: EvidenceService) {}

  /**
   * Streamed with the session cookie. Ends its own response (`@Res()` without passthrough)
   * because it is bytes, not the JSON envelope. `nosniff` + a fixed type: the browser must
   * not reinterpret an uploaded file.
   */
  @Get(':evidenceId/file')
  @RequirePermissions(Permission.EVIDENCE_READ)
  async file(@Param('evidenceId', ParseUUIDPipe) evidenceId: string, @Res() response: Response): Promise<void> {
    const file = await this.evidence.getFile(evidenceId);
    response
      .status(200)
      .set({
        'Content-Type': file.mimeType,
        'Content-Length': String(file.data.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      })
      .end(file.data);
  }
}
