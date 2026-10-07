-- Branch heads are appointed per cohort/year, matching treasurer scope.
-- Existing legacy branch-head rows had no year. Preserve them by assigning the first
-- existing branch heads to the first available cohorts; subsequent appointments use
-- the explicit year account selected in the UI.
ALTER TABLE "officer_assignments"
  DROP CONSTRAINT IF EXISTS "officer_assignments_scope_check";

WITH ranked_heads AS (
  SELECT id, row_number() OVER (ORDER BY active_from, id) AS rn
  FROM "officer_assignments"
  WHERE officer_role = 'BRANCH_HEAD' AND active_to IS NULL AND year_account_id IS NULL
), ranked_years AS (
  SELECT id, row_number() OVER (ORDER BY year_level) AS rn
  FROM "year_accounts"
  WHERE active = true
)
UPDATE "officer_assignments" oa
SET year_account_id = ry.id
FROM ranked_heads rh
JOIN ranked_years ry ON ry.rn = rh.rn
WHERE oa.id = rh.id;

ALTER TABLE "officer_assignments"
  DROP CONSTRAINT IF EXISTS "officer_assignments_scope_check";

ALTER TABLE "officer_assignments"
  ADD CONSTRAINT "officer_assignments_scope_check" CHECK (
    ("officer_role" = 'TREASURER'   AND "year_account_id" IS NOT NULL) OR
    ("officer_role" = 'BRANCH_HEAD' AND "year_account_id" IS NOT NULL)
  );

-- A cohort/year has at most one active branch head.
CREATE UNIQUE INDEX "uq_active_branch_head_per_year"
  ON "officer_assignments" ("year_account_id")
  WHERE "officer_role" = 'BRANCH_HEAD' AND "active_to" IS NULL;
