import { SubsystemRole } from './core-hub-identity';
import { CORE_ROLE_TO_SUBSYSTEM_ROLE, mapCoreRoleToSubsystemRole } from './role-mapping';

describe('role mapping (authorization.md 3)', () => {
  it('maps the core roles this subsystem accepts', () => {
    expect(mapCoreRoleToSubsystemRole('student')).toBe(SubsystemRole.STUDENT);
    expect(mapCoreRoleToSubsystemRole('lecturer')).toBe(SubsystemRole.LECTURER);
    expect(mapCoreRoleToSubsystemRole('staff')).toBe(SubsystemRole.STAFF);
    expect(mapCoreRoleToSubsystemRole('admin')).toBe(SubsystemRole.ADMIN);
  });

  it('keeps lecturers apart from students and admins: they read but never file or decide', () => {
    expect(mapCoreRoleToSubsystemRole('lecturer')).not.toBe(SubsystemRole.STUDENT);
    expect(mapCoreRoleToSubsystemRole('lecturer')).not.toBe(SubsystemRole.ADMIN);
  });

  it('gives alumni and guests no access: unlisted core roles map to null (the guard answers 403)', () => {
    expect(mapCoreRoleToSubsystemRole('alumni')).toBeNull();
    expect(mapCoreRoleToSubsystemRole('guest')).toBeNull();
  });

  it('never invents a role for an unknown or missing value - treasurer and branch head are not core roles', () => {
    expect(mapCoreRoleToSubsystemRole('treasurer')).toBeNull();
    expect(mapCoreRoleToSubsystemRole('branch_head')).toBeNull();
    expect(mapCoreRoleToSubsystemRole('BRANCH_HEAD')).toBeNull();
    expect(mapCoreRoleToSubsystemRole(undefined)).toBeNull();
    expect(mapCoreRoleToSubsystemRole('')).toBeNull();
  });

  it('is case-insensitive about the claim', () => {
    expect(mapCoreRoleToSubsystemRole(' Student ')).toBe(SubsystemRole.STUDENT);
  });

  it('only uses the six core role names of the contract as keys', () => {
    const core = ['student', 'alumni', 'staff', 'lecturer', 'guest', 'admin'];
    for (const key of Object.keys(CORE_ROLE_TO_SUBSYSTEM_ROLE)) {
      expect(core).toContain(key);
    }
  });

  it('is frozen: nothing can add a role at runtime', () => {
    expect(Object.isFrozen(CORE_ROLE_TO_SUBSYSTEM_ROLE)).toBe(true);
  });
});
