import { TransactionStatus, TransactionType } from '../../generated/prisma/client';
import { ApprovalsService } from './approvals.service';

jest.mock('../shared/transaction-lock', () => ({
  lockTransaction: jest.fn().mockResolvedValue(undefined),
}));

describe('ApprovalsService year-scoped decisions', () => {
  const user = {
    id: 'branch-head-user',
    email: 'branch-head@example.test',
    coreRole: 'student',
    sessionId: 'session',
    subsystemRole: 'STUDENT',
    exp: Math.floor(Date.now() / 1000) + 3600,
  } as any;

  const baseTransaction = {
    id: 'transaction-1',
    yearAccountId: 'year-1',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    amountSatang: 1000,
    transactionDate: new Date('2026-10-08'),
    description: 'Test expense',
    category: null,
    sourceType: 'MANUAL',
    externalReference: null,
    idempotencyKey: null,
    createdByCoreUserId: 'treasurer-user',
    createdByPersonCode: null,
    approvedByCoreUserId: null,
    approvedByPersonCode: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function makeService() {
    const scope = {
      assertMayDecide: jest.fn(),
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      transaction: {
        findUnique: jest.fn().mockResolvedValue(baseTransaction),
        update: jest.fn().mockResolvedValue({
          ...baseTransaction,
          status: TransactionStatus.APPROVED,
          approvedByCoreUserId: user.id,
        }),
      },
      expenseEvidence: {
        count: jest.fn().mockResolvedValue(1),
      },
      approvalAction: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const people = {
      myPersonCode: jest.fn().mockResolvedValue('BH001'),
    };
    const referenceData = {};

    const service = new ApprovalsService(
      prisma as never,
      scope as never,
      audit as never,
      people as never,
      referenceData as never,
    );

    return { service, scope, tx };
  }

  it('allows a branch head to approve a transaction in their assigned year', async () => {
    const { service, scope } = makeService();

    await service.approve(user, 'transaction-1', 'token');

    expect(scope.assertMayDecide).toHaveBeenCalledTimes(1);
    expect(scope.assertMayDecide).toHaveBeenCalledWith(user, 'year-1');
  });

  it('rejects a transaction from another year through the year-scoped decision check', async () => {
    const { service, scope, tx } = makeService();
    tx.transaction.findUnique.mockResolvedValue({
      ...baseTransaction,
      yearAccountId: 'year-2',
    } as never);

    scope.assertMayDecide.mockImplementation(async (_user: unknown, yearAccountId?: string) => {
      if (yearAccountId !== 'year-1') {
        throw new Error('FORBIDDEN');
      }
    });

    await expect(service.approve(user, 'transaction-1', 'token')).rejects.toThrow('FORBIDDEN');
    expect(scope.assertMayDecide).toHaveBeenCalledTimes(1);
    expect(scope.assertMayDecide).toHaveBeenCalledWith(user, 'year-2');
  });
});
