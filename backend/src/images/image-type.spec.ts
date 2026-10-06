import { isPdf, sniffEvidenceType, sniffImageType } from './image-type';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);

describe('sniffImageType: the bytes decide, not the claimed type', () => {
  it('recognises JPEG, PNG and WebP', () => {
    expect(sniffImageType(JPEG)).toBe('image/jpeg');
    expect(sniffImageType(PNG)).toBe('image/png');
    expect(sniffImageType(WEBP)).toBe('image/webp');
  });

  it('a PDF is not an image (Core Hub /images does not take it) but it is accepted evidence', () => {
    const pdf = Buffer.from('%PDF-1.7\n...');
    expect(sniffImageType(pdf)).toBeNull();
    expect(isPdf(pdf)).toBe(true);
    expect(sniffEvidenceType(pdf)).toBe('application/pdf');
  });

  it('classifies evidence by content: image, PDF, or nothing', () => {
    expect(sniffEvidenceType(JPEG)).toBe('image/jpeg');
    expect(sniffEvidenceType(Buffer.from('MZ\x90\x00 not a bill'))).toBeNull();
    expect(sniffEvidenceType(Buffer.from('<html></html>'))).toBeNull();
    expect(isPdf(Buffer.from('%PD'))).toBe(false);
  });

  it('rejects SVG / HTML dressed up as an image', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
  });

  it('rejects RIFF files that are not WebP (e.g. WAV) and empty or tiny input', () => {
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
