import { describe, expect, it } from 'vitest';
import { Role } from '../types';
import {
  AUTH_ROLES_COLLECTION,
  LEGACY_ROLE_STORAGE_KEY,
  MESSAGES,
  clearLegacyRoleStorage,
  dashboardRequiresSignIn,
  decideDashboardAccess,
  endDashboardSession,
  messageForSignInError,
  parseDashboardRole,
  validateSignInInput,
  type SignedInIdentity,
} from './authAccess';
import { authFixtureFromSearch } from './authFixture';

const supervisor: SignedInIdentity = {
  uid: 'uid-supervisor',
  email: 'supervisor@ramko-inj.com',
  displayName: 'Pat Supervisor',
};

describe('dashboard role mapping', () => {
  it('accepts only the exact admin and supervisor strings the rules check', () => {
    expect(parseDashboardRole('admin')).toBe(Role.ADMIN);
    expect(parseDashboardRole('supervisor')).toBe(Role.SUPERVISOR);
    expect(parseDashboardRole(Role.ADMIN)).toBe(Role.ADMIN);
    expect(parseDashboardRole(Role.SUPERVISOR)).toBe(Role.SUPERVISOR);
  });

  it('rejects every other claim, including lookalike roles', () => {
    for (const value of [
      'Admin',
      'SUPERVISOR',
      'admin ',
      ' supervisor',
      'viewer',
      'employee',
      'owner',
      '',
      null,
      undefined,
      1,
      true,
      { role: 'admin' },
    ]) {
      expect(parseDashboardRole(value)).toBeNull();
    }
  });
});

describe('dashboard auth gating', () => {
  it('keeps a visitor with no Firebase user signed out', () => {
    expect(decideDashboardAccess(null, null)).toEqual({ kind: 'signed_out' });
    expect(decideDashboardAccess({ uid: '', email: null, displayName: null }, {
      status: 'found',
      data: { role: 'admin' },
    })).toEqual({ kind: 'signed_out' });
  });

  it('does not treat an allowlist payload as access when nobody is signed in', () => {
    const decision = decideDashboardAccess(null, { status: 'found', data: { role: 'admin' } });
    expect(decision.kind).toBe('signed_out');
  });

  it('waits while the signed-in user\'s role document is still loading', () => {
    expect(decideDashboardAccess(supervisor, null)).toEqual({ kind: 'checking' });
  });

  it('signs out a Firebase user who has no allowlist document', () => {
    expect(decideDashboardAccess(supervisor, { status: 'missing' })).toEqual({
      kind: 'sign_out_and_deny',
      message: MESSAGES.missingRole,
    });
  });

  it('signs out when the role document cannot be read', () => {
    expect(decideDashboardAccess(supervisor, { status: 'unreadable', code: 'permission-denied' })).toEqual({
      kind: 'sign_out_and_deny',
      message: MESSAGES.roleUnreadable,
    });
    expect(decideDashboardAccess(supervisor, { status: 'unreadable', code: 'unavailable' })).toEqual({
      kind: 'sign_out_and_deny',
      message: MESSAGES.roleLookupFailed,
    });
  });

  it('signs out viewer, employee, and any role other than admin or supervisor', () => {
    for (const role of ['viewer', 'employee', 'Admin', 'admin ', 'owner']) {
      const decision = decideDashboardAccess(supervisor, { status: 'found', data: { role } });
      expect(decision).toEqual({ kind: 'sign_out_and_deny', message: MESSAGES.roleNotAllowed });
    }
    expect(decideDashboardAccess(supervisor, { status: 'found', data: {} }).kind).toBe('sign_out_and_deny');
    expect(decideDashboardAccess(supervisor, { status: 'found', data: null }).kind).toBe('sign_out_and_deny');
  });

  it('maps an allowlisted supervisor or admin onto the menu user', () => {
    const asSupervisor = decideDashboardAccess(supervisor, {
      status: 'found',
      data: { role: 'supervisor', email: 'supervisor@ramko-inj.com' },
    });
    expect(asSupervisor).toEqual({
      kind: 'allow',
      user: {
        uid: 'uid-supervisor',
        email: 'supervisor@ramko-inj.com',
        role: Role.SUPERVISOR,
        displayName: 'Pat Supervisor',
      },
    });

    const asAdmin = decideDashboardAccess(
      { uid: 'uid-admin', email: 'admin@ramko-inj.com', displayName: null },
      { status: 'found', data: { role: 'admin' } },
    );
    expect(asAdmin).toEqual({
      kind: 'allow',
      user: {
        uid: 'uid-admin',
        email: 'admin@ramko-inj.com',
        role: Role.ADMIN,
        displayName: 'admin@ramko-inj.com',
      },
    });
  });

  it('uses the allowlist role even if another field says something else', () => {
    const decision = decideDashboardAccess(supervisor, {
      status: 'found',
      data: { role: 'supervisor', requestedRole: 'admin', isAdmin: true },
    });
    expect(decision.kind).toBe('allow');
    if (decision.kind === 'allow') expect(decision.user.role).toBe(Role.SUPERVISOR);
  });
});

describe('sign-in validation and errors', () => {
  it('requires a single email address and a password', () => {
    expect(validateSignInInput('  supervisor@ramko-inj.com ', 'secret')).toEqual({ ok: true });
    expect(validateSignInInput('not-an-email', 'secret')).toEqual({ ok: false, message: MESSAGES.invalidEmail });
    expect(validateSignInInput('@ramko-inj.com', 'secret').ok).toBe(false);
    expect(validateSignInInput('a@b@c.com', 'secret').ok).toBe(false);
    expect(validateSignInInput('supervisor@ramko-inj.com', '')).toEqual({
      ok: false,
      message: MESSAGES.missingPassword,
    });
  });

  it('uses one message for a bad email or password so accounts are not enumerated', () => {
    expect(messageForSignInError('auth/user-not-found')).toBe(MESSAGES.wrongCredentials);
    expect(messageForSignInError('auth/wrong-password')).toBe(MESSAGES.wrongCredentials);
    expect(messageForSignInError('auth/invalid-credential')).toBe(MESSAGES.wrongCredentials);
    expect(messageForSignInError('auth/user-disabled')).toBe(MESSAGES.userDisabled);
    expect(messageForSignInError('auth/too-many-requests')).toBe(MESSAGES.tooManyRequests);
    expect(messageForSignInError('something-else')).toBe(MESSAGES.signInFailed);
  });
});

describe('sign-out', () => {
  it('clears the Firebase session and then the legacy role key', async () => {
    const order: string[] = [];
    await endDashboardSession({
      signOut: async () => {
        order.push('firebase');
      },
      storage: {
        removeItem: key => {
          order.push(key);
        },
      },
    });
    expect(order).toEqual(['firebase', LEGACY_ROLE_STORAGE_KEY]);
  });

  it('still drops the legacy role key when Firebase sign-out fails', async () => {
    const removed: string[] = [];
    await expect(endDashboardSession({
      signOut: async () => {
        throw new Error('network');
      },
      storage: { removeItem: key => removed.push(key) },
    })).rejects.toThrow('network');
    expect(removed).toEqual([LEGACY_ROLE_STORAGE_KEY]);
  });

  it('ignores a storage failure while clearing the legacy key', () => {
    expect(() => clearLegacyRoleStorage({
      removeItem: () => {
        throw new Error('blocked');
      },
    })).not.toThrow();
  });
});

describe('who must sign in', () => {
  it('leaves the FN-135 tablet path open and gates every other path', () => {
    expect(dashboardRequiresSignIn('/FN135')).toBe(false);
    expect(dashboardRequiresSignIn('/')).toBe(true);
    expect(dashboardRequiresSignIn('/fn135')).toBe(true);
    expect(dashboardRequiresSignIn('/FN135/')).toBe(true);
  });
});

describe('dev auth fixture', () => {
  it('is off unless the dev flag and the auth fixture query are both set', () => {
    expect(authFixtureFromSearch('?fixture=auth&screen=admin', false)).toBeNull();
    expect(authFixtureFromSearch('?fixture=employee-profile', true)).toBeNull();
    expect(authFixtureFromSearch('', true)).toBeNull();
    expect(authFixtureFromSearch('?fixture=auth', true)).toBe('login');
    expect(authFixtureFromSearch('?fixture=auth&screen=denied', true)).toBe('denied');
    expect(authFixtureFromSearch('?fixture=auth&screen=supervisor', true)).toBe('supervisor');
    expect(authFixtureFromSearch('?fixture=auth&screen=nope', true)).toBe('login');
  });
});

describe('allowlist collection name', () => {
  it('matches the collection the rules and the console steps use', () => {
    expect(AUTH_ROLES_COLLECTION).toBe('auth_roles');
  });
});
