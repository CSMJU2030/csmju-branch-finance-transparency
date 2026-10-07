import { HttpStatus, Injectable } from '@nestjs/common';
import { Transaction } from '../../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { AppException, ErrorCode } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import { createHash } from 'node:crypto';
import { MAX_IMAGE_BYTES, PDF_TYPE, sniffEvidenceType } from '../images/image-type';
import { ImagesService } from '../images/images.service';
import { OfficerScopeService } from '../officers/officer-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation, lockTransaction } from '../shared/transaction-lock';
import { undecidedStatus } from '../transactions/transactions.service';

/** Every column but the file bytes: list queries must never drag a 10 MB PDF along. */
const EVIDENCE_LIST_SELECT = {
  id: true,
  transactionId: true,
  imageId: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  version: true,
  isCurrent: true,
  uploadedAt: true,
} as const;

interface EvidenceListRow {
  id: string;
  transactionId: string;
  imageId: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isCurrent: boolean;
  uploadedAt: Date;
}

export interface UploadedBill {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}


/** A name that is safe to keep and show: no path, no control characters, bounded. */
export function cleanFilename(name: string): string {
  const printable = [...(name.split(/[\\/]/).pop() ?? '')]
    .filter((char) => char.charCodeAt(0) > 0x1f && char.charCodeAt(0) !== 0x7f)
    .join('');
  const base = printable.trim();
  return (base || 'bill').slice(0, 200);
}

/**
 * Bills are images or PDFs. An image goes to Core Hub's POST /images with the
 * uploader's own token and only its `id` is kept here; a PDF, which Core Hub does not
 * take, is stored in this database (temporary, approved deviation - REPORT.md). Replacing a bill adds a new version
 * (history is never erased); the earlier image is deliberately left at Core Hub.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficerScopeService,
    private readonly audit: AuditService,
    private readonly people: PeopleService,
    private readonly images: ImagesService,
  ) {}

  async upload(user: CoreHubIdentity, transactionId: string, file: UploadedBill | undefined, token: string) {
    const bill = this.checkFile(file);

    // Cheap checks first, so a request that cannot succeed never uploads anything.
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) {
      throw AppException.notFound('Transaction not found');
    }
    this.assertAcceptsBills(transaction);
    await this.scope.assertTreasurerOf(user, transaction.yearAccountId);

    const personCode = await this.people.myPersonCode(token);
    const filename = cleanFilename(bill.originalname);
    const isPdfBill = bill.type === PDF_TYPE;

    // Images go to Core Hub with the uploader's own token (reference-data.md 6). A PDF cannot:
    // Core Hub's image service does not take it, so its bytes are kept in this database. That
    // PDF path is a temporary, approved deviation from the standard (see REPORT.md).
    const image = isPdfBill
      ? null
      : await this.images.upload(token, { buffer: bill.buffer, mimeType: bill.type, filename });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Same lock as approve / edit / cancel: a bill cannot land on a row that was
        // decided between the check above and this write.
        await lockTransaction(tx, transactionId);
        const fresh = await tx.transaction.findUnique({ where: { id: transactionId } });
        if (!fresh) {
          throw AppException.notFound('Transaction not found');
        }
        this.assertAcceptsBills(fresh);

        const previous = await tx.expenseEvidence.findFirst({
          where: { transactionId, isCurrent: true },
          orderBy: { version: 'desc' },
          select: { id: true },
        });
        if (previous) {
          await tx.expenseEvidence.update({ where: { id: previous.id }, data: { isCurrent: false } });
        }
        const latest = await tx.expenseEvidence.aggregate({ where: { transactionId }, _max: { version: true } });

        const row = await tx.expenseEvidence.create({
          data: {
            transactionId,
            imageId: image?.id ?? null,
            fileData: isPdfBill ? new Uint8Array(bill.buffer) : null,
            checksum: createHash('sha256').update(bill.buffer).digest('hex'),
            originalFilename: filename,
            mimeType: image?.mimeType ?? PDF_TYPE,
            sizeBytes: image?.sizeBytes ?? bill.buffer.length,
            uploadedByCoreUserId: user.id,
            version: (latest._max.version ?? 0) + 1,
            isCurrent: true,
          },
          select: EVIDENCE_LIST_SELECT,
        });
        await this.audit.record(
          {
            actorCoreUserId: user.id,
            actorPersonCode: personCode,
            action: 'UPLOAD_BILL',
            targetType: 'Transaction',
            targetId: transactionId,
            yearAccountId: fresh.yearAccountId,
            afterJson: {
              evidenceId: row.id,
              version: row.version,
              kind: isPdfBill ? 'PDF' : 'IMAGE',
              mimeType: row.mimeType,
            },
          },
          tx,
        );
        return row;
      });
      return this.present(created);
    } catch (error) {
      // The row was not written: do not leave an unreferenced bill at Core Hub.
      if (image) {
        await this.images.discard(token, image.id);
      }
      if (isUniqueViolation(error)) {
        throw AppException.conflict('Another bill was attached at the same moment - try again');
      }
      throw error;
    }
  }

  /** Bills of one transaction, newest version first. Readable by everyone who can read the books. */
  async list(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) {
      throw AppException.notFound('Transaction not found');
    }
    const rows = await this.prisma.expenseEvidence.findMany({
      where: { transactionId },
      orderBy: { version: 'desc' },
      select: EVIDENCE_LIST_SELECT,
    });
    return rows.map((row) => this.present(row));
  }

  /**
   * The bytes of a bill kept in this database (a PDF). Same visibility as the books:
   * everyone who can read transactions can read their evidence. Images are not served
   * from here - they are Core Hub's.
   */
  async getFile(evidenceId: string) {
    const row = await this.prisma.expenseEvidence.findUnique({
      where: { id: evidenceId },
      select: { fileData: true, mimeType: true, originalFilename: true, checksum: true },
    });
    if (!row || !row.fileData) {
      throw AppException.notFound('Bill file not found');
    }
    return { data: Buffer.from(row.fileData), mimeType: row.mimeType, filename: row.originalFilename, checksum: row.checksum };
  }

  private present(row: EvidenceListRow) {
    const isPdfBill = row.imageId === null;
    return {
      id: row.id,
      transactionId: row.transactionId,
      kind: isPdfBill ? ('PDF' as const) : ('IMAGE' as const),
      /**
       * Where to load it. An image is a public Core Hub file URL (reference-data.md 6); a PDF
       * is served by THIS subsystem, behind the session cookie.
       */
      url: isPdfBill
        ? `/api/v1/evidence/${row.id}/file`
        : this.images.fileUrl(row.imageId as string),
      imageId: row.imageId,
      originalFilename: row.originalFilename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      version: row.version,
      isCurrent: row.isCurrent,
      uploadedAt: row.uploadedAt,
    };
  }

  /**
   * Once decided (approved, rejected, voided, cancelled) a transaction's evidence is
   * frozen: what the branch head reviewed must not change underneath them.
   */
  private assertAcceptsBills(transaction: Transaction): void {
    const expected = undecidedStatus(transaction.type);
    if (transaction.status !== expected) {
      throw AppException.conflict(
        `Transaction is ${transaction.status}, not ${expected} - a bill can no longer be attached`,
      );
    }
  }

  /** Format and size, judged by the bytes themselves (the claimed type is only a claim). */
  private checkFile(file: UploadedBill | undefined): { buffer: Buffer; type: string; originalname: string } {
    const invalid = (message: string) =>
      new AppException(ErrorCode.VALIDATION_ERROR, 'Validation failed', HttpStatus.BAD_REQUEST, [message]);

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw invalid('file is required (multipart/form-data field "file")');
    }
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw invalid('file must be 10 MB or smaller');
    }
    const type = sniffEvidenceType(file.buffer);
    if (!type) {
      throw invalid('file must be a PDF, JPEG, PNG or WebP');
    }
    if (file.mimetype !== type) {
      throw invalid(`file content is ${type} but it was sent as ${file.mimetype}`);
    }
    return { buffer: file.buffer, type, originalname: file.originalname };
  }
}
