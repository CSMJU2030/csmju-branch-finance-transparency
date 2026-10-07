/**
 * Development seed: the four cohorts a branch always has, and nothing about people.
 *
 *   pnpm prisma:seed        (after `pnpm prisma:deploy`)
 *
 * What it does NOT do, on purpose:
 *  - create users or passwords: people sign in at Core Hub (SSO) and exist here only
 *    as the `core_user_id` of the token;
 *  - appoint officers: an administrator signed in through Core Hub does that with
 *    POST /api/v1/officer-assignments (src/officers) - the first branch head included;
 *  - run on the server: deployment.md 3.4 forbids seeding sample data at start-up.
 *
 * Idempotent: it only creates what is missing, so it can be run twice safely.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }),
});

/** Academic year label (Buddhist era) the seeded cohorts are measured from. Override with SEED_CURRENT_ACADEMIC_YEAR. */
const CURRENT_ACADEMIC_YEAR = Number(process.env.SEED_CURRENT_ACADEMIC_YEAR ?? 2569);

async function main(): Promise<void> {
  for (const yearLevel of [1, 2, 3, 4]) {
    const exists = await prisma.yearAccount.findFirst({ where: { yearLevel, active: true } });
    if (exists) {
      continue;
    }
    // A cohort now in year N entered N - 1 years ago.
    const entryYear = CURRENT_ACADEMIC_YEAR - (yearLevel - 1);
    const account = await prisma.yearAccount.create({
      data: {
        yearLevel,
        name: `Year ${yearLevel} (${entryYear})`,
        entryAcademicYearLabel: String(entryYear),
        openingBalanceSatang: 0,
      },
    });
    // Every active cohort needs a current period (ended_at = null): advanceAcademicYear closes it.
    await prisma.yearLevelPeriod.create({
      data: { yearAccountId: account.id, academicYear: String(CURRENT_ACADEMIC_YEAR), yearLevel },
    });
    console.log(`created ${account.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
