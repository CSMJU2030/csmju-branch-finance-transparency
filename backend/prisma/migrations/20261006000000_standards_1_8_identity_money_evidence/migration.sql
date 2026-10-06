-- ============================================================================
-- Conform to CSMJU2030 standards 1.8 (data-dictionary.md 3/5/9, reference-data.md 6/8).
--
-- Hand-written on purpose (data-dictionary.md 9.3): `prisma migrate dev` would
-- turn every rename below into drop + add and lose the data.
--
--  1. Identity   users table + UUID FKs  ->  core_user_id TEXT (+ person_code)
--  2. Offices    user_year_assignments   ->  officer_assignments (TREASURER / BRANCH_HEAD, Layer 2)
--  3. Money      DECIMAL(14,2)           ->  INTEGER satang
--  4. Evidence   local disk storage_key  ->  Core Hub image_id
--  5. LINE OA quick entry removed (see REPORT.md: blocked by DD-01 and by the
--     rule that only a Core Hub token may act for a user)
--  6. created_at / updated_at on every table
--  7. audit_logs and approval_actions become append-only (trigger)
--
-- The old `*_username` columns that migration 20260926150000 filled with
-- users.external_user_id already hold the external id as TEXT, so they are
-- RENAMED into the new core_user_id columns; no data is invented.
--
-- Values of `core_user_id` that came from the old dev header stub (t1, bh1, ...)
-- are NOT real Core Hub `sub` values. This subsystem has never been deployed on
-- the dev-header stub, so that is only demo data; re-key it before any go-live.
-- ============================================================================

-- Bills on local disk cannot be moved to Core Hub /images by a migration (the
-- files are not reachable from SQL, and Core Hub only takes JPEG/PNG/WebP).
-- Refuse loudly instead of dropping the references.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "expense_evidence") THEN
    RAISE EXCEPTION
      'expense_evidence still has rows that point at files on local disk. Re-upload them to Core Hub (POST /images) and delete these rows, or reset this development database (pnpm db:reset), then run the migration again.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. LINE OA quick entry (tables first: they reference users)
-- ---------------------------------------------------------------------------
DROP TABLE "line_message_events";
DROP TABLE "line_link_codes";
DROP TABLE "line_account_links";
DROP TYPE "LineMessageStatus";
-- TransactionSourceType keeps LINE_REPORT: Postgres cannot drop one enum value
-- without rewriting the type, and old rows may still carry it.

-- ---------------------------------------------------------------------------
-- 1 + 3. transactions: identity and money
-- ---------------------------------------------------------------------------
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_created_by_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_approved_by_fkey";
DROP INDEX "transactions_created_by_idx";
ALTER TABLE "transactions" DROP COLUMN "created_by";
ALTER TABLE "transactions" DROP COLUMN "approved_by";
ALTER TABLE "transactions" RENAME COLUMN "created_by_username" TO "created_by_core_user_id";
ALTER TABLE "transactions" RENAME COLUMN "approved_by_username" TO "approved_by_core_user_id";
ALTER TABLE "transactions" ADD COLUMN "created_by_person_code" TEXT;
ALTER TABLE "transactions" ADD COLUMN "approved_by_person_code" TEXT;
CREATE INDEX "transactions_created_by_core_user_id_idx" ON "transactions"("created_by_core_user_id");

ALTER TABLE "transactions" DROP CONSTRAINT "transactions_amount_check";
-- ROUND(x * 100): baht with two decimals -> whole satang. A value that does not
-- fit INTEGER (> 21,474,836.47 baht) aborts the migration instead of truncating.
ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount" * 100)::INTEGER;
ALTER TABLE "transactions" RENAME COLUMN "amount" TO "amount_satang";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_satang_check" CHECK ("amount_satang" > 0);

-- ---------------------------------------------------------------------------
-- 3. year_accounts / year_level_periods: money
-- ---------------------------------------------------------------------------
ALTER TABLE "year_accounts" ALTER COLUMN "opening_balance" DROP DEFAULT;
ALTER TABLE "year_accounts" ALTER COLUMN "opening_balance" TYPE INTEGER USING ROUND("opening_balance" * 100)::INTEGER;
ALTER TABLE "year_accounts" ALTER COLUMN "opening_balance" SET DEFAULT 0;
ALTER TABLE "year_accounts" RENAME COLUMN "opening_balance" TO "opening_balance_satang";

ALTER TABLE "year_level_periods" ALTER COLUMN "closing_balance" TYPE INTEGER USING ROUND("closing_balance" * 100)::INTEGER;
ALTER TABLE "year_level_periods" RENAME COLUMN "closing_balance" TO "closing_balance_satang";
ALTER TABLE "year_level_periods" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "year_level_periods" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- 1 + 4. expense_evidence: identity and Core Hub image id (table is empty - see guard)
-- ---------------------------------------------------------------------------
ALTER TABLE "expense_evidence" DROP CONSTRAINT "expense_evidence_uploaded_by_fkey";
ALTER TABLE "expense_evidence" DROP COLUMN "uploaded_by";
ALTER TABLE "expense_evidence" DROP COLUMN "storage_key";
ALTER TABLE "expense_evidence" RENAME COLUMN "uploaded_by_username" TO "uploaded_by_core_user_id";
-- A bill is a Core Hub image (image_id) or - for PDF, which Core Hub does not take - the
-- file itself (file_data). Exactly one of the two.
ALTER TABLE "expense_evidence" ADD COLUMN "image_id" TEXT;
ALTER TABLE "expense_evidence" ADD COLUMN "file_data" BYTEA;
ALTER TABLE "expense_evidence" ADD CONSTRAINT "expense_evidence_one_storage_check"
  CHECK (("image_id" IS NOT NULL) <> ("file_data" IS NOT NULL));
ALTER TABLE "expense_evidence" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "expense_evidence" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- Never two "current" bills for one transaction, whatever the application does.
CREATE UNIQUE INDEX "uq_current_evidence_per_transaction"
  ON "expense_evidence" ("transaction_id")
  WHERE "is_current" = true;

-- ---------------------------------------------------------------------------
-- 1. approval_actions / audit_logs: identity
-- ---------------------------------------------------------------------------
ALTER TABLE "approval_actions" DROP CONSTRAINT "approval_actions_actor_id_fkey";
ALTER TABLE "approval_actions" DROP COLUMN "actor_id";
ALTER TABLE "approval_actions" RENAME COLUMN "actor_username" TO "actor_core_user_id";
ALTER TABLE "approval_actions" ADD COLUMN "actor_person_code" TEXT;
ALTER TABLE "approval_actions" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";
ALTER TABLE "audit_logs" DROP COLUMN "actor_id";
ALTER TABLE "audit_logs" RENAME COLUMN "actor_username" TO "actor_core_user_id";
ALTER TABLE "audit_logs" ADD COLUMN "actor_person_code" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- 2. user_year_assignments -> officer_assignments (Layer 2 offices of a student)
-- ---------------------------------------------------------------------------
CREATE TYPE "OfficerRole" AS ENUM ('TREASURER', 'BRANCH_HEAD');

DROP INDEX "uq_active_treasurer_per_year";
ALTER TABLE "user_year_assignments" DROP CONSTRAINT "user_year_assignments_assignee_id_fkey";
ALTER TABLE "user_year_assignments" DROP COLUMN "assignee_id";
ALTER TABLE "user_year_assignments" RENAME COLUMN "username" TO "core_user_id";
ALTER TABLE "user_year_assignments" ALTER COLUMN "year_account_id" DROP NOT NULL;

-- The branch head used to be implicit (users.role = BRANCH_HEAD, no row). Make it an
-- explicit, active office before the users table goes away.
INSERT INTO "user_year_assignments" ("core_user_id", "role", "year_account_id")
SELECT u."external_user_id", 'BRANCH_HEAD', NULL
FROM "users" u
WHERE u."role" = 'BRANCH_HEAD' AND u."active" = true;

-- STUDENT was never an office; the old model only kept TREASURER rows.
DELETE FROM "user_year_assignments" WHERE "role" = 'STUDENT';

ALTER TABLE "user_year_assignments"
  ALTER COLUMN "role" TYPE "OfficerRole" USING ("role"::text::"OfficerRole");
ALTER TABLE "user_year_assignments" RENAME COLUMN "role" TO "officer_role";

ALTER TABLE "user_year_assignments" RENAME TO "officer_assignments";
ALTER TABLE "officer_assignments" RENAME CONSTRAINT "user_year_assignments_pkey" TO "officer_assignments_pkey";
ALTER TABLE "officer_assignments" RENAME CONSTRAINT "user_year_assignments_year_account_id_fkey" TO "officer_assignments_year_account_id_fkey";
ALTER INDEX "user_year_assignments_year_account_id_role_idx" RENAME TO "officer_assignments_year_account_id_officer_role_idx";

ALTER TABLE "officer_assignments" ADD COLUMN "person_code" TEXT;
ALTER TABLE "officer_assignments" ADD COLUMN "granted_by_core_user_id" TEXT;
ALTER TABLE "officer_assignments" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "officer_assignments" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX "officer_assignments_core_user_id_active_to_idx" ON "officer_assignments"("core_user_id", "active_to");

-- A treasurer belongs to a cohort, the branch head to the whole branch.
ALTER TABLE "officer_assignments" ADD CONSTRAINT "officer_assignments_scope_check" CHECK (
  ("officer_role" = 'TREASURER'   AND "year_account_id" IS NOT NULL) OR
  ("officer_role" = 'BRANCH_HEAD' AND "year_account_id" IS NULL)
);
-- At most one ACTIVE treasurer per cohort (Prisma cannot express a partial index).
CREATE UNIQUE INDEX "uq_active_treasurer_per_year"
  ON "officer_assignments" ("year_account_id")
  WHERE "officer_role" = 'TREASURER' AND "active_to" IS NULL;
-- ...and nobody holds the branch head office twice.
CREATE UNIQUE INDEX "uq_active_branch_head_per_person"
  ON "officer_assignments" ("core_user_id")
  WHERE "officer_role" = 'BRANCH_HEAD' AND "active_to" IS NULL;

-- ---------------------------------------------------------------------------
-- 1. The local user table is gone: identity lives at Core Hub.
-- ---------------------------------------------------------------------------
DROP TABLE "users";
DROP TYPE "Role";

-- ---------------------------------------------------------------------------
-- 6. created_at / updated_at on the remaining tables
-- ---------------------------------------------------------------------------
ALTER TABLE "integration_sources" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "integration_sources" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "integration_events" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "integration_events" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "integration_events" ALTER COLUMN "received_at" TYPE TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 7. Append-only tables. The application role owns this database, so REVOKE
-- cannot protect them; a trigger rejects every UPDATE and DELETE regardless of
-- who sends it (only dropping the trigger - itself a visible schema change -
-- lifts it). Created last so the conversions above can still rewrite rows.
-- ---------------------------------------------------------------------------
CREATE FUNCTION "reject_modification"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on "%" is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "reject_modification"();

CREATE TRIGGER "approval_actions_append_only"
  BEFORE UPDATE OR DELETE ON "approval_actions"
  FOR EACH ROW EXECUTE FUNCTION "reject_modification"();
