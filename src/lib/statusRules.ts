/**
 * statusRules.ts — Single source of truth for compliance status resolution.
 * Components import status logic from here — never compute inline.
 */

import { ComplianceStatus } from '../types';
import type { Assignment, Employee, CheckMissing } from '../types';
import { parseAppSheetDate, isPast } from './dateUtils';

/* ─── Status Colors ─── */

export const STATUS_COLORS: Record<ComplianceStatus, string> = {
  [ComplianceStatus.COMPLETED]:    '#00d4aa',
  [ComplianceStatus.PENDING]:      '#3b82f6',
  [ComplianceStatus.OVERDUE]:      '#ef4444',
  [ComplianceStatus.NOT_ASSIGNED]: '#6b7280',
  [ComplianceStatus.EXEMPT]:       '#8b5cf6',
  [ComplianceStatus.SICK_LEAVE]:   '#f59e0b',
  [ComplianceStatus.NOT_SENT]:     '#f97316',
  [ComplianceStatus.INACTIVE]:     '#374151',
};

export const STATUS_LABELS: Record<ComplianceStatus, string> = {
  [ComplianceStatus.COMPLETED]:    'Completed',
  [ComplianceStatus.PENDING]:      'Pending',
  [ComplianceStatus.OVERDUE]:      'Overdue',
  [ComplianceStatus.NOT_ASSIGNED]: 'Not Assigned',
  [ComplianceStatus.EXEMPT]:       'Exempt',
  [ComplianceStatus.SICK_LEAVE]:   'Sick Leave',
  [ComplianceStatus.NOT_SENT]:     'Not Sent',
  [ComplianceStatus.INACTIVE]:     'Inactive',
};

/* ─── Status Resolution ─── */

/**
 * Resolve the compliance status for a given assignment + employee context.
 * Priority order:
 *   1. Inactive employee → INACTIVE
 *   2. No assignment → NOT_ASSIGNED
 *   3. Status === 'Completed' → COMPLETED
 *   4. CheckMissing cell = 'Sick Leave' → SICK_LEAVE
 *   5. CheckMissing cell = 'No sent' / 'No Sent' → NOT_SENT
 *   6. Past due date → OVERDUE
 *   7. Otherwise → PENDING
 */
export function resolveAssignmentStatus(
  assignment: Assignment | null | undefined,
  employee: Employee | null | undefined,
  today: Date = new Date(),
  checkMissingCell?: string | number | null,
): ComplianceStatus {
  // 1. Inactive employee
  if (employee && isInactiveEmployee(employee)) {
    return ComplianceStatus.INACTIVE;
  }

  // 2. No assignment
  if (!assignment) {
    return ComplianceStatus.NOT_ASSIGNED;
  }

  // 3. Completed
  if (normalizeStatus(assignment.Status) === 'completed') {
    return ComplianceStatus.COMPLETED;
  }

  // 4/5. Check missing matrix special values
  if (checkMissingCell != null) {
    const cellStr = String(checkMissingCell).trim().toLowerCase();
    if (cellStr === 'sick leave') return ComplianceStatus.SICK_LEAVE;
    if (cellStr === 'no sent' || cellStr === 'not sent') return ComplianceStatus.NOT_SENT;
  }

  // 6. Overdue
  if (isOverdue(assignment, today)) {
    return ComplianceStatus.OVERDUE;
  }

  // 7. Pending
  return ComplianceStatus.PENDING;
}

/** Check if an assignment is overdue */
export function isOverdue(assignment: Assignment, today: Date = new Date()): boolean {
  const due = parseAppSheetDate(assignment.DueDate);
  if (!due) return false;
  return isPast(due, today) && normalizeStatus(assignment.Status) !== 'completed';
}

/** Check if a department's completion rate is below the risk threshold */
export function isHighRisk(rate: number, threshold = 0.8): boolean {
  return rate < threshold;
}

/** Check if an employee record indicates inactive status */
export function isInactiveEmployee(employee: Employee): boolean {
  const pt = (employee.perm_temp || '').trim().toUpperCase();
  return pt === 'INACTIVE' || pt === 'TERMINATED';
}

/** Normalize raw status string for comparison */
function normalizeStatus(status: string | null | undefined): string {
  return (status || '').trim().toLowerCase();
}

/** Convert a boolean-like value from AppSheet (TRUE/FALSE/1/0) */
export function toBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'YES';
  }
  return false;
}
