import { Prisma } from '../../generated/prisma/client';

/**
 * Locks one transaction row (SELECT ... FOR UPDATE) for the rest of the
 * surrounding database transaction.
 *
 * Every write that depends on a transaction's current status - edit, cancel,
 * approve, reject, void, attach a bill - takes this lock first and only then
 * reads the status. Two requests for the same row therefore run one after the
 * other: a branch head cannot approve the amount a treasurer is editing at the
 * same moment, and a bill cannot land on a row that was just approved.
 */
export async function lockTransaction(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "transactions" WHERE "id" = ${id}::uuid FOR UPDATE`;
}

/** A unique-constraint violation (Prisma P2002), e.g. a second active treasurer. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}
