import { SubsystemRole } from './core-hub-identity';

/**
 * Subsystem permissions (authorization.md 4): `<resource>:<action>[:own|:any]`.
 *
 *   Core JWT -> Core Role -> Subsystem Role -> Permission -> Business Operation
 *
 * Business code asks for a permission, never for `role === 'admin'`.
 *
 * Two layers decide who may do what:
 *   1. the ROLE-level permission below (checked by PermissionsGuard) - what a request
 *      may even attempt;
 *   2. for a `student`, the OFFICE (Layer 2) checked in the service against real data
 *      (OfficerScopeService), exactly like `:own`:
 *        - filing (expense / income / bill)     -> active TREASURER of THAT year account
 *        - deciding (approve, reject, void, audit, advance year) -> active BRANCH_HEAD
 *        - appointing a treasurer               -> active BRANCH_HEAD
 *      An admin decides and appoints without an office.
 *
 * Lecturers hold read permissions only. Nobody holds both filing and deciding
 * permissions as a role-level capability for the same person except through the
 * office checks - a branch head never files, and a treasurer never decides.
 */
export enum Permission {
  YEAR_ACCOUNT_READ = 'year-account:read',
  /** Close the academic year: promote cohorts, graduate the last one. */
  YEAR_ACCOUNT_ADVANCE = 'year-account:advance',

  TRANSACTION_READ = 'transaction:read',
  /** Bills attached to a transaction, and their files. */
  EVIDENCE_READ = 'evidence:read',

  /** Filing: treasurer of the cohort. */
  EXPENSE_CREATE = 'expense:create',
  INCOME_CREATE = 'income:create',
  TRANSACTION_UPDATE_OWN = 'transaction:update:own',
  TRANSACTION_CANCEL_OWN = 'transaction:cancel:own',
  EVIDENCE_CREATE = 'evidence:create',

  /** Deciding: branch head or admin. */
  APPROVAL_READ = 'approval:read',
  TRANSACTION_APPROVE = 'transaction:approve',
  TRANSACTION_REJECT = 'transaction:reject',
  TRANSACTION_VOID = 'transaction:void',
  INCOME_CONFIRM = 'income:confirm',
  AUDIT_READ = 'audit:read',

  /** Who holds which office. */
  OFFICER_READ_OWN = 'officer:read:own',
  OFFICER_READ_ANY = 'officer:read:any',
  OFFICER_MANAGE = 'officer:manage',
}

const READ_ONLY: Permission[] = [
  Permission.YEAR_ACCOUNT_READ,
  Permission.TRANSACTION_READ,
  Permission.EVIDENCE_READ,
];

const FILING: Permission[] = [
  Permission.EXPENSE_CREATE,
  Permission.INCOME_CREATE,
  Permission.TRANSACTION_UPDATE_OWN,
  Permission.TRANSACTION_CANCEL_OWN,
  Permission.EVIDENCE_CREATE,
];

const DECIDING: Permission[] = [
  Permission.YEAR_ACCOUNT_ADVANCE,
  Permission.APPROVAL_READ,
  Permission.TRANSACTION_APPROVE,
  Permission.TRANSACTION_REJECT,
  Permission.TRANSACTION_VOID,
  Permission.INCOME_CONFIRM,
  Permission.AUDIT_READ,
];

/** A student may attempt filing and deciding; the office check in the service says yes or no. */
const STUDENT_PERMISSIONS: Permission[] = [
  ...READ_ONLY,
  ...FILING,
  ...DECIDING,
  Permission.OFFICER_READ_OWN,
  Permission.OFFICER_READ_ANY,
  Permission.OFFICER_MANAGE,
];

/** Lecturers read the books; they never file or decide. */
const LECTURER_PERMISSIONS: Permission[] = [...READ_ONLY];

/** Admins decide and appoint officers. They never file: filing is the treasurer's. */
const ADMIN_PERMISSIONS: Permission[] = [
  ...READ_ONLY,
  ...DECIDING,
  Permission.OFFICER_READ_ANY,
  Permission.OFFICER_MANAGE,
];

/** Roles the mapping does not produce but the enum names: they hold nothing. */
const NO_PERMISSIONS: Permission[] = [];

export const ROLE_PERMISSIONS: Readonly<Record<SubsystemRole, readonly Permission[]>> =
  Object.freeze({
    [SubsystemRole.STUDENT]: Object.freeze(STUDENT_PERMISSIONS),
    [SubsystemRole.LECTURER]: Object.freeze(LECTURER_PERMISSIONS),
    [SubsystemRole.ADMIN]: Object.freeze(ADMIN_PERMISSIONS),
    [SubsystemRole.STAFF]: Object.freeze(NO_PERMISSIONS),
    [SubsystemRole.ALUMNI]: Object.freeze(NO_PERMISSIONS),
  });

/** The permissions only an office holder may exercise (checked in the service). */
export const FILING_PERMISSIONS: readonly Permission[] = Object.freeze(FILING);
export const DECIDING_PERMISSIONS: readonly Permission[] = Object.freeze(DECIDING);

/** Does this subsystem role hold the given permission? */
export function can(role: SubsystemRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Does this subsystem role hold at least one of the given permissions? */
export function canAny(role: SubsystemRole, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}
