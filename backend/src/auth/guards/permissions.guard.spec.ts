import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthEventsLogger } from '../auth-events.logger';
import { SubsystemRole } from '../core-hub-identity';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { Permission } from '../permissions';
import { PermissionsGuard } from './permissions.guard';

function contextFor(user: { subsystemRole: SubsystemRole } | undefined, required: Permission[] | undefined) {
  const handler = () => undefined;
  if (required) Reflect.defineMetadata(PERMISSIONS_KEY, required, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user, path: '/api/v1/x' }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard: 403 when the role lacks the permission (authorization.md 5)', () => {
  const events = { authorizationDenied: jest.fn() } as unknown as AuthEventsLogger;
  const guard = new PermissionsGuard(new Reflector(), events);

  it('lets a student read transactions', () => {
    expect(guard.canActivate(contextFor({ subsystemRole: SubsystemRole.STUDENT }, [Permission.TRANSACTION_READ]))).toBe(true);
  });

  it('answers 403 FORBIDDEN (never 401, never 404) when a lecturer tries to approve', () => {
    let error: any;
    try {
      guard.canActivate(contextFor({ subsystemRole: SubsystemRole.LECTURER }, [Permission.TRANSACTION_APPROVE]));
    } catch (e) {
      error = e;
    }
    expect(error?.getStatus()).toBe(403);
    expect(error?.code).toBe('FORBIDDEN');
    expect(events.authorizationDenied).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'missing_permission', required: [Permission.TRANSACTION_APPROVE] }),
    );
  });

  it('answers 401 only when nobody is identified', () => {
    expect(() => guard.canActivate(contextFor(undefined, [Permission.TRANSACTION_READ]))).toThrow(/Bearer/);
  });
});
