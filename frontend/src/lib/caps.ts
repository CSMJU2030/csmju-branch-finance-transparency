import type { Me, Offices } from "./api";

/**
 * What this person may do, for showing or hiding things. Only a convenience: the
 * backend checks the same rules on every request.
 *   - files entries: a student holding the TREASURER office (for those cohorts)
 *   - decides: a student holding the BRANCH_HEAD office, or an admin
 *   - manages offices: the same two (a branch head appoints treasurers only)
 */
export type Caps = {
  canFile: boolean;
  canDecide: boolean;
  canManageOffices: boolean;
  isBranchHead: boolean;
  isAdmin: boolean;
  treasurerYearAccountIds: string[];
};

export function capsOf(me: Me, offices: Offices | null): Caps {
  const isAdmin = me.subsystemRole === "ADMIN";
  const isBranchHead = offices?.isBranchHead ?? false;
  const treasurerYearAccountIds = offices?.treasurerYearAccountIds ?? [];
  return {
    canFile: treasurerYearAccountIds.length > 0,
    canDecide: isAdmin || isBranchHead,
    canManageOffices: isAdmin || isBranchHead,
    isBranchHead,
    isAdmin,
    treasurerYearAccountIds,
  };
}

/** A short label for the shell: the Core Hub role plus the office, if any. */
export function roleSummary(me: Me, caps: Caps): string {
  if (me.subsystemRole === "STUDENT") {
    if (caps.canFile) return "นักศึกษา · เหรัญญิก";
    if (caps.isBranchHead) return "นักศึกษา · หัวหน้าสาขา";
  }
  return "";
}
