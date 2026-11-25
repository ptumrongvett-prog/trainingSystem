/**
 * permissions.ts — Permission checks for the signed-in dashboard user.
 * The role is the one read from auth_roles. QC access is enforced in firestore.rules.
 */

import { Role } from '../types';
import type { AppSection } from './roles';
import { canView, canExport, canAccessSettings } from './roles';

export interface AuthUser {
  uid: string;
  email: string;
  role: Role;
  empKey?: string;
  displayName?: string;
}

/** Check if user has access to a section */
export function checkSectionAccess(user: AuthUser | null, section: AppSection): boolean {
  if (!user) return false;
  return canView(user.role, section);
}

/** Check if user can export data */
export function checkExportAccess(user: AuthUser | null): boolean {
  if (!user) return false;
  return canExport(user.role);
}

/** Check if user can modify settings */
export function checkSettingsAccess(user: AuthUser | null): boolean {
  if (!user) return false;
  return canAccessSettings(user.role);
}

/** Create a default local user (no auth backend) */
export function createLocalUser(role: Role, identifier?: string): AuthUser {
  return {
    uid: 'local',
    email: identifier || 'local@dashboard',
    role,
    empKey: role === Role.EMPLOYEE ? identifier : undefined,
    displayName: role.charAt(0).toUpperCase() + role.slice(1),
  };
}
