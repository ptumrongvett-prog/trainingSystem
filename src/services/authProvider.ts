/**
 * authProvider.ts — Firebase Auth ready structure.
 * Currently uses local role selection (no auth backend).
 * Structured for Firebase Auth / SSO integration.
 */

import { Role } from '../types';
import type { AuthUser } from '../lib/permissions';
import { createLocalUser } from '../lib/permissions';

// ─── Future Firebase Auth Integration ───
// import { initializeApp } from 'firebase/app';
// import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
};

/**
 * Initialize auth.
 * Currently returns a local user based on role selection.
 * Future: initialize Firebase Auth and listen for auth state changes.
 */
export function initLocalAuth(role: Role, identifier?: string): AuthState {
  return {
    user: createLocalUser(role, identifier),
    loading: false,
    error: null,
  };
}

/**
 * Change the current role (local auth only).
 */
export function switchRole(role: Role, identifier?: string): AuthUser {
  return createLocalUser(role, identifier);
}

/**
 * Placeholder for Firebase Auth sign-in.
 * Uncomment and configure when Firebase is ready.
 */
// export async function signIn(email: string, password: string): Promise<AuthUser> {
//   const auth = getAuth();
//   const credential = await signInWithEmailAndPassword(auth, email, password);
//   const user = credential.user;
//   // Fetch role from Firestore custom claims or user profile
//   const role = await fetchUserRole(user.uid);
//   return {
//     uid: user.uid,
//     email: user.email || '',
//     role,
//     displayName: user.displayName || '',
//   };
// }

/**
 * Placeholder for sign-out.
 */
// export async function signOut(): Promise<void> {
//   const auth = getAuth();
//   await auth.signOut();
// }

/**
 * Placeholder for auth state listener.
 */
// export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
//   const auth = getAuth();
//   return onAuthStateChanged(auth, async (firebaseUser) => {
//     if (firebaseUser) {
//       const role = await fetchUserRole(firebaseUser.uid);
//       callback({
//         uid: firebaseUser.uid,
//         email: firebaseUser.email || '',
//         role,
//         displayName: firebaseUser.displayName || '',
//       });
//     } else {
//       callback(null);
//     }
//   });
// }
