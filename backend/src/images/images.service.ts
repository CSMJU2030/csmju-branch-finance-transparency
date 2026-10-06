import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors';
import { CoreHubCallError, coreHubFailure, retryAfterSeconds } from '../core-hub/core-hub-http';

export interface CoreHubImage {
  id: string;
  mimeType: string;
  sizeBytes: number;
}

/** An upload carries up to 10 MB, so it gets longer than the 5 s of a plain data call. */
const UPLOAD_TIMEOUT_MS = 20_000;
const DELETE_TIMEOUT_MS = 5_000;

/**
 * Files live at Core Hub, not here (deployment.md 3.4: the container is read-only
 * and "ไฟล์ที่ผู้ใช้อัปโหลดเก็บผ่าน Core Hub"). A bill is uploaded with POST /images
 * using the token of the user whose request this is (reference-data.md 6, 7.1:
 * never logged, never passed on) and only its `id` is kept.
 *
 * What Core Hub accepts is JPEG, PNG and WebP up to 10 MB; it re-encodes every
 * image to WebP. PDF is not accepted - see REPORT.md.
 */
@Injectable()
export class ImagesService {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('coreHub.url', 'http://localhost:3000').replace(/\/+$/, '');
  }

  /** Where a browser can load the image (`GET /images/:id/file` is public: no token). */
  fileUrl(imageId: string): string {
    return `${this.baseUrl}/api/v1/images/${encodeURIComponent(imageId)}/file`;
  }

  async upload(token: string, file: { buffer: Buffer; mimeType: string; filename: string }): Promise<CoreHubImage> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename);
    // GENERAL, never PROFILE: PROFILE replaces the user's own picture at Core Hub.
    form.append('category', 'GENERAL');
    form.append('subsystem', this.config.get<string>('subsystemId', ''));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/v1/images`, {
          method: 'POST',
          signal: controller.signal,
          headers: { accept: 'application/json', authorization: `Bearer ${token}` },
          body: form,
        });
      } catch (error) {
        throw coreHubFailure(
          new CoreHubCallError(
            controller.signal.aborted
              ? `Core Hub did not answer within ${UPLOAD_TIMEOUT_MS} ms`
              : `Core Hub could not be reached (${error instanceof Error ? error.message : 'unknown error'})`,
            0,
          ),
        );
      }

      if (response.status === 400 || response.status === 413 || response.status === 415 || response.status === 422) {
        // Checked before sending, so reaching this means Core Hub disagrees with our own checks.
        throw AppException.badRequest('Core Hub did not accept this image');
      }
      if (!response.ok) {
        throw coreHubFailure(
          new CoreHubCallError(
            `Core Hub responded with HTTP ${response.status}`,
            response.status,
            retryAfterSeconds(response.headers.get('retry-after')),
          ),
        );
      }

      const body = (await response.json().catch(() => null)) as {
        success?: unknown;
        data?: { id?: unknown; mimeType?: unknown; sizeBytes?: unknown };
      } | null;
      const data = body?.data;
      if (body?.success !== true || typeof data?.id !== 'string' || data.id.length === 0) {
        throw coreHubFailure(new Error('POST /images answered without an image id'));
      }
      return {
        id: data.id,
        mimeType: typeof data.mimeType === 'string' ? data.mimeType : file.mimeType,
        sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : file.buffer.length,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Best effort: removes an image whose database row could not be written, so a
   * failed request does not leave a bill nobody references. Never throws.
   */
  async discard(token: string, imageId: string): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELETE_TIMEOUT_MS);
    try {
      await fetch(`${this.baseUrl}/api/v1/images/${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
        signal: controller.signal,
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // nothing more to do: the image stays at Core Hub, owned by the uploader
    } finally {
      clearTimeout(timer);
    }
  }
}
