import { SubsystemRole } from './core-hub-identity';

/**
 * Core Hub role -> Subsystem role (authorization.md 3).
 *
 *   Core Hub Role      Subsystem Role
 *   ---------------------------------
 *   student            STUDENT     reads the books. A student who ALSO holds an office
 *                                  (treasurer / branch head, see src/officers) can file
 *                                  or decide - the office is checked in the service.
 *   lecturer           LECTURER    reads the books, never files or decides
 *   admin              ADMIN       decides, and appoints officers
 *   staff              STAFF       reads financial data/logs, manages Layer 2, closes the year
 *   alumni, guest        -- not listed: no access --
 *
 * This table MUST equal `default_role_mapping` declared for this subsystem in the Core
 * Hub Subsystem Registry (reviewers compare them by eye). A core role that is not a key
 * here cannot enter the subsystem (403 at Core Hub and here).
 *
 * "Treasurer" and "branch head" are Layer 2 roles: facts about a person that only this
 * subsystem knows (data-dictionary.md 10), kept against `core_user_id` in
 * `officer_assignments`. When Core Hub can carry per-person subsystem roles in the token
 * (subsystem-registry.md 7) they can move there and that table can be retired.
 */
export const CORE_ROLE_TO_SUBSYSTEM_ROLE: Readonly<Record<string, SubsystemRole>> = Object.freeze({
  student: SubsystemRole.STUDENT,
  lecturer: SubsystemRole.LECTURER,
  staff: SubsystemRole.STAFF,
  admin: SubsystemRole.ADMIN,
});

/**
 * Returns the subsystem role for a Core Hub role, or `null` when the Core Hub
 * role has no meaning in this subsystem (authenticated, but not authorized).
 */
export function mapCoreRoleToSubsystemRole(coreRole: string | undefined): SubsystemRole | null {
  if (typeof coreRole !== 'string') {
    return null;
  }
  return CORE_ROLE_TO_SUBSYSTEM_ROLE[coreRole.trim().toLowerCase()] ?? null;
}
