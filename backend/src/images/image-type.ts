/** What Core Hub's POST /images takes (reference-data.md 6). SVG and PDF are not in it. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export const PDF_TYPE = 'application/pdf' as const;
export type EvidenceFileType = AcceptedImageType | typeof PDF_TYPE;

/** Core Hub's own limit, applied to every bill (PDF included) so the rule is one number. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * The type of an image judged by its first bytes, not by the name or the
 * Content-Type the client claims - both are free text. Null when the bytes are
 * none of the accepted formats.
 */
export function sniffImageType(buffer: Buffer): AcceptedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** A PDF starts with `%PDF-` (the spec allows a little leading junk; real bills do not use it). */
export function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** Image or PDF, by content. Null when it is neither. */
export function sniffEvidenceType(buffer: Buffer): EvidenceFileType | null {
  return sniffImageType(buffer) ?? (isPdf(buffer) ? PDF_TYPE : null);
}
