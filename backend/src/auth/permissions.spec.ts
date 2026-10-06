import { SubsystemRole } from './core-hub-identity';
import { DECIDING_PERMISSIONS, FILING_PERMISSIONS, Permission, ROLE_PERMISSIONS, can, canAny } from './permissions';

describe('permission matrix (authorization.md 4, 6)', () => {
  it('uses the <resource>:<action>[:own|:any] naming', () => {
    for (const permission of Object.values(Permission)) {
      expect(permission).toMatch(/^[a-z-]+:[a-z-]+(:(own|any))?$/);
    }
  });

  it('everyone who can sign in reads the books', () => {
    for (const role of [SubsystemRole.STUDENT, SubsystemRole.LECTURER, SubsystemRole.ADMIN]) {
      expect(can(role, Permission.TRANSACTION_READ)).toBe(true);
      expect(can(role, Permission.YEAR_ACCOUNT_READ)).toBe(true);
      expect(can(role, Permission.EVIDENCE_READ)).toBe(true);
    }
  });

  it('lecturers are read-only: they can never file, decide or manage offices', () => {
    for (const permission of [...FILING_PERMISSIONS, ...DECIDING_PERMISSIONS, Permission.OFFICER_MANAGE]) {
      expect(can(SubsystemRole.LECTURER, permission)).toBe(false);
    }
  });

  it('admins decide and appoint officers, but never file', () => {
    for (const permission of DECIDING_PERMISSIONS) {
      expect(can(SubsystemRole.ADMIN, permission)).toBe(true);
    }
    expect(can(SubsystemRole.ADMIN, Permission.OFFICER_MANAGE)).toBe(true);
    for (const permission of FILING_PERMISSIONS) {
      expect(can(SubsystemRole.ADMIN, permission)).toBe(false);
    }
  });

  it('a student may ATTEMPT filing and deciding; the office check in the service answers yes or no', () => {
    for (const permission of [...FILING_PERMISSIONS, ...DECIDING_PERMISSIONS]) {
      expect(can(SubsystemRole.STUDENT, permission)).toBe(true);
    }
  });

  it('staff and alumni (not accepted by the mapping) hold nothing', () => {
    expect(ROLE_PERMISSIONS[SubsystemRole.STAFF]).toHaveLength(0);
    expect(ROLE_PERMISSIONS[SubsystemRole.ALUMNI]).toHaveLength(0);
  });

  it('no role-level capability lets an ADMIN file: filing stays with the treasurer office', () => {
    expect(canAny(SubsystemRole.ADMIN, FILING_PERMISSIONS)).toBe(false);
  });

  it('every permission is held by at least one role (no dead permission)', () => {
    const held = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const permission of Object.values(Permission)) {
      expect(held.has(permission)).toBe(true);
    }
  });

  it('canAny passes when one of several permissions is held', () => {
    expect(canAny(SubsystemRole.LECTURER, [Permission.TRANSACTION_APPROVE, Permission.TRANSACTION_READ])).toBe(true);
    expect(canAny(SubsystemRole.LECTURER, [Permission.TRANSACTION_APPROVE, Permission.AUDIT_READ])).toBe(false);
  });
});
