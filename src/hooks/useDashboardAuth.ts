/**
 * Firebase session for the dashboard. Disabled on the dev fixture screens
 * and on the FN-135 route (that route never mounts this hook).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  MESSAGES,
  clearLegacyRoleStorage,
  decideDashboardAccess,
  errorCode,
  messageForSignInError,
  validateSignInInput,
} from '../lib/authAccess';
import type { AuthUser } from '../lib/permissions';
import {
  listenDashboardAuth,
  readAllowlist,
  signInDashboard,
  signOutDashboard,
} from '../services/authProvider';

export type DashboardAuthPhase = 'checking' | 'signed_out' | 'ready';

export function useDashboardAuth(enabled: boolean) {
  const [phase, setPhase] = useState<DashboardAuthPhase>(enabled ? 'checking' : 'signed_out');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [trackedEnabled, setTrackedEnabled] = useState(enabled);

  if (enabled !== trackedEnabled) {
    setTrackedEnabled(enabled);
    setPhase(enabled ? 'checking' : 'signed_out');
    if (!enabled) setUser(null);
  }

  useEffect(() => {
    if (!enabled) return;

    let generation = 0;
    const unsubscribe = listenDashboardAuth(identity => {
      const ticket = ++generation;
      if (!identity) {
        setUser(null);
        setPhase('signed_out');
        clearLegacyRoleStorage(window.localStorage);
        return;
      }

      setPhase('checking');
      void readAllowlist(identity.uid).then(lookup => {
        if (ticket !== generation) return;
        const decision = decideDashboardAccess(identity, lookup);
        if (decision.kind === 'allow') {
          setUser(decision.user);
          setError(null);
          setPhase('ready');
          clearLegacyRoleStorage(window.localStorage);
          return;
        }
        if (decision.kind === 'sign_out_and_deny') {
          setUser(null);
          setError(decision.message);
          setPhase('signed_out');
          void signOutDashboard().catch(() => {
            setError(`${decision.message} ${MESSAGES.signOutFailed}`);
          });
        }
      });
    });

    return () => {
      generation += 1;
      unsubscribe();
    };
  }, [enabled]);

  const signIn = useCallback(async (email: string, password: string) => {
    const validation = validateSignInInput(email, password);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signInDashboard(email, password);
    } catch (err) {
      setError(messageForSignInError(errorCode(err)));
    } finally {
      setSubmitting(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    setUser(null);
    setPhase('signed_out');
    try {
      await signOutDashboard();
    } catch {
      setError(MESSAGES.signOutFailed);
    }
  }, []);

  return { phase, user, error, submitting, signIn, signOut };
}
