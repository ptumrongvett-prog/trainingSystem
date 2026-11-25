/**
 * Dashboard sign-in decisions. These functions never talk to Firebase.
 *
 * A supervisor or admin must have a Firebase Auth user and an `auth_roles/{uid}`
 * document whose `role` is exactly `admin` or `supervisor`. Firestore rules read
 * that same document before allowing QC reads. A role picked in the browser,
 * or the old `training_auth_role` localStorage value, is not an input here.
 *
 * The FN-135 tablet path does not sign in. Employees stay signed out.
 */

import type { AuthUser } from './permissions';
import { Role } from '../types';

/** Firestore collection Pear fills in the console. Document id is the Auth uid. */
export const AUTH_ROLES_COLLECTION = 'auth_roles';

/** Shared-password era. Cleared on sign-in and sign-out so it cannot reopen the dashboard. */
export const LEGACY_ROLE_STORAGE_KEY = 'training_auth_role';

export type DashboardRole = Role.ADMIN | Role.SUPERVISOR;

export type SignedInIdentity = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type AllowlistLookup =
  | { status: 'found'; data: unknown }
  | { status: 'missing' }
  | { status: 'unreadable'; code: string };

export type AccessDecision =
  | { kind: 'checking' }
  | { kind: 'signed_out' }
  | { kind: 'sign_out_and_deny'; message: string }
  | { kind: 'allow'; user: AuthUser };

export const MESSAGES = {
  invalidEmail: 'Enter the email address for your supervisor or admin account.',
  missingPassword: 'Enter your password.',
  signInFailed: 'Sign-in failed. Check the email and password and try again.',
  wrongCredentials: 'Email or password is incorrect.',
  userDisabled: 'This account is disabled. Ask an administrator.',
  tooManyRequests: 'Too many attempts. Wait a moment and try again.',
  network: 'Network error. Check the connection and try again.',
  missingRole:
    'This account has no dashboard role. An administrator must create an auth_roles document whose id is this user’s UID, with role set to admin or supervisor.',
  roleNotAllowed:
    'This account cannot open the dashboard. Only an auth_roles document with role admin or supervisor is allowed.',
  roleUnreadable:
    'Firestore would not let this account read its role. Publish the auth_roles rules, then sign in again.',
  roleLookupFailed: 'The role check failed, so this account was signed out. Try again when the connection is back.',
  signOutFailed: 'Sign-out did not finish. Try again to clear the Firebase session.',
} as const;

/** Exact match. Rules compare the same strings and have no lowercase helper. */
export function parseDashboardRole(value: unknown): DashboardRole | null {
  if (value === Role.ADMIN || value === Role.SUPERVISOR) return value;
  return null;
}

export function validateSignInInput(
  email: string,
  password: string,
): { ok: true } | { ok: false; message: string } {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at !== trimmed.lastIndexOf('@') || at === trimmed.length - 1) {
    return { ok: false, message: MESSAGES.invalidEmail };
  }
  if (!password) return { ok: false, message: MESSAGES.missingPassword };
  return { ok: true };
}

export function errorCode(err: unknown): string {
  if (typeof err === 'object' && err && 'code' in err) return String((err as { code: unknown }).code);
  return '';
}

export function messageForSignInError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return MESSAGES.invalidEmail;
    case 'auth/user-disabled':
      return MESSAGES.userDisabled;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return MESSAGES.wrongCredentials;
    case 'auth/too-many-requests':
      return MESSAGES.tooManyRequests;
    case 'auth/network-request-failed':
      return MESSAGES.network;
    default:
      return MESSAGES.signInFailed;
  }
}

export function messageForUnreadableRole(code: string): string {
  if (code === 'permission-denied' || code === 'unauthenticated') return MESSAGES.roleUnreadable;
  return MESSAGES.roleLookupFailed;
}

/**
 * Decide whether this Firebase user may open the dashboard.
 * `lookup === null` means the allowlist document has not been read yet.
 * No identity (students, signed-out visitors, a leftover localStorage role)
 * stays signed out even if an allowlist payload is passed in.
 */
export function decideDashboardAccess(
  identity: SignedInIdentity | null,
  lookup: AllowlistLookup | null,
): AccessDecision {
  if (!identity?.uid) return { kind: 'signed_out' };
  if (lookup == null) return { kind: 'checking' };

  if (lookup.status === 'unreadable') {
    return { kind: 'sign_out_and_deny', message: messageForUnreadableRole(lookup.code) };
  }
  if (lookup.status === 'missing') {
    return { kind: 'sign_out_and_deny', message: MESSAGES.missingRole };
  }

  const role = parseDashboardRole(roleField(lookup.data));
  if (!role) return { kind: 'sign_out_and_deny', message: MESSAGES.roleNotAllowed };

  const email = (identity.email ?? '').trim();
  return {
    kind: 'allow',
    user: {
      uid: identity.uid,
      email,
      role,
      displayName: identity.displayName?.trim() || email || role,
    },
  };
}

function roleField(data: unknown): unknown {
  if (!data || typeof data !== 'object') return undefined;
  return (data as { role?: unknown }).role;
}

export function clearLegacyRoleStorage(storage: { removeItem: (key: string) => void }): void {
  try {
    storage.removeItem(LEGACY_ROLE_STORAGE_KEY);
  } catch {
    // Private-mode storage can throw. The Firebase session is the credential.
  }
}

/** Firebase sign-out first, then drop the old shared-password key even if sign-out throws. */
export async function endDashboardSession(deps: {
  signOut: () => Promise<void>;
  storage: { removeItem: (key: string) => void };
}): Promise<void> {
  try {
    await deps.signOut();
  } finally {
    clearLegacyRoleStorage(deps.storage);
  }
}

/** `/FN135` is the tablet form. It must keep working with no Firebase user. */
export function dashboardRequiresSignIn(pathname: string): boolean {
  return pathname !== '/FN135';
}
