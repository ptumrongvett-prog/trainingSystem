/**
 * roles.ts — Role definitions and access control.
 * UI-level role selection for now, structured for Firebase Auth later.
 */

import { Role } from '../types';

/** Sections in the app */
export type AppSection =
  | 'overview' | 'topics' | 'departments' | 'matrix'
  | 'supervisor' | 'quiz' | 'audit' | 'alerts'
  | 'insights' | 'quality' | 'settings' | 'reports' | 'fn135'
  | 'partTraining';

/** Section access matrix */
const SECTION_ACCESS: Record<Role, AppSection[]> = {
  [Role.ADMIN]: [
    'overview', 'topics', 'departments', 'matrix',
    'supervisor', 'quiz', 'audit', 'alerts',
    'insights', 'quality', 'settings', 'reports', 'fn135', 'partTraining',
  ],
  [Role.SUPERVISOR]: [
    'overview', 'topics', 'departments', 'matrix',
    'supervisor', 'fn135', 'partTraining',
  ],
  [Role.VIEWER]: [
    'overview', 'topics', 'departments', 'matrix',
    'supervisor',
  ],
  [Role.EMPLOYEE]: [
    'overview',
  ],
};

export function canView(role: Role, section: AppSection): boolean {
  return SECTION_ACCESS[role]?.includes(section) ?? false;
}

export function canExport(role: Role): boolean {
  return role === Role.ADMIN || role === Role.SUPERVISOR;
}

export function canAccessSettings(role: Role): boolean {
  return role === Role.ADMIN;
}

export function getAccessibleSections(role: Role): AppSection[] {
  return SECTION_ACCESS[role] || [];
}

/**
 * Get data filter scope based on role.
 * Supervisors see only their employees, Employees see only themselves.
 */
export function getFilterScope(
  role: Role,
  userIdentifier?: string,
): { supervisorEmail?: string; empKey?: string } | null {
  switch (role) {
    case Role.ADMIN:
    case Role.VIEWER:
      return null; // No filter — see everything
    case Role.SUPERVISOR:
      return userIdentifier ? { supervisorEmail: userIdentifier } : null;
    case Role.EMPLOYEE:
      return userIdentifier ? { empKey: userIdentifier } : null;
    default:
      return null;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]:      'Administrator',
  [Role.SUPERVISOR]: 'Supervisor',
  [Role.VIEWER]:     'Viewer',
  [Role.EMPLOYEE]:   'Employee',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.ADMIN]:      'Full dashboard, export, settings, all data',
  [Role.SUPERVISOR]: 'Department/shift data, follow-up, export',
  [Role.VIEWER]:     'Read-only overview and charts',
  [Role.EMPLOYEE]:   'Personal training status only',
};
