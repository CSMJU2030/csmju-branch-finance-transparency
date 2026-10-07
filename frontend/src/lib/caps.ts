import type { Me, Offices } from "./api";

/**
 * What this person may do, for showing or hiding things. Only a convenience: the
 * backend checks the same rules on every request.
 *   - files entries: a student holding the TREASURER office (for those cohorts)
 *   - decides: a student holding the BRANCH_HEAD office, or an admin
 *   - staff can read financial data, view audit logs, manage Layer 2, and close the year
 */
export type Caps = {
  canFile: boolean;
  canDecide: boolean;
  canCloseYear: boolean;
  canManageOffices: boolean;
  canManageAllOffices: boolean;
  canViewAudit: boolean;
  isBranchHead: boolean;
  isAdmin: boolean;
  treasurerYearAccountIds: string[];
};

export function capsOf(me: Me, offices: Offices | null): Caps {
  const isAdmin = me.subsystemRole === "ADMIN";
  const isStaffManager = me.subsystemRole === "STAFF";
  const isBranchHead = offices?.isBranchHead ?? false;
  const treasurerYearAccountIds = offices?.treasurerYearAccountIds ?? [];
  return {
    canFile: treasurerYearAccountIds.length > 0,
    canDecide: isAdmin || isBranchHead,
    canCloseYear: isAdmin || isStaffManager || isBranchHead,
    canManageOffices: isAdmin || isStaffManager || isBranchHead,
    canManageAllOffices: isAdmin || isStaffManager,
    canViewAudit: isAdmin || isStaffManager || isBranchHead,
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
  if (me.coreRole.trim().toLowerCase() === "staff" && me.subsystemRole === "STAFF") {
    return "บุคลากร · เจ้าหน้าที่ระบบ";
  }
  return "";
}
