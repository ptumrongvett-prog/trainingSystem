/**
 * Firebase Auth for the supervisor and admin dashboard.
 * Role mapping and the sign-out contract live in src/lib/authAccess.ts.
 * The FN-135 route never calls these functions.
 */

import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  AUTH_ROLES_COLLECTION,
  endDashboardSession,
  errorCode,
  type AllowlistLookup,
  type SignedInIdentity,
} from '../lib/authAccess';
import type { AuthUser } from '../lib/permissions';
import { dashboardAuth, db } from './firebaseConfig';

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
};

export async function readAllowlist(uid: string): Promise<AllowlistLookup> {
  try {
    const snap = await getDoc(doc(db, AUTH_ROLES_COLLECTION, uid));
    if (!snap.exists()) return { status: 'missing' };
    return { status: 'found', data: snap.data() };
  } catch (err) {
    return { status: 'unreadable', code: errorCode(err) };
  }
}

export async function signInDashboard(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(dashboardAuth(), email.trim(), password);
}

export async function signOutDashboard(): Promise<void> {
  await endDashboardSession({
    signOut: () => firebaseSignOut(dashboardAuth()),
    storage: window.localStorage,
  });
}

export function listenDashboardAuth(onChange: (identity: SignedInIdentity | null) => void): () => void {
  return onAuthStateChanged(dashboardAuth(), user => {
    if (!user) {
      onChange(null);
      return;
    }
    onChange({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });
  });
}
