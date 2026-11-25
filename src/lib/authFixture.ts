/**
 * Dev-server screens for the sign-in flow. Production builds ignore the query.
 * These screens do not create a Firebase session and do not read QC data.
 */

export type AuthFixtureScreen = 'login' | 'error' | 'denied' | 'supervisor' | 'admin';

const SCREENS: readonly AuthFixtureScreen[] = ['login', 'error', 'denied', 'supervisor', 'admin'];

export function authFixtureFromSearch(search: string, dev: boolean): AuthFixtureScreen | null {
  if (!dev) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('fixture') !== 'auth') return null;
  const screen = params.get('screen');
  if (screen && (SCREENS as readonly string[]).includes(screen)) return screen as AuthFixtureScreen;
  return 'login';
}

export function currentAuthFixture(): AuthFixtureScreen | null {
  if (typeof window === 'undefined') return null;
  return authFixtureFromSearch(window.location.search, import.meta.env.DEV);
}
