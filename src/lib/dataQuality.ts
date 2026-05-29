/**
 * dataQuality.ts — 12 data quality checks with weighted health scoring.
 * Pure functions. No data mutation. Additive only (Phase 5).
 */

import type { Employee, Assignment, QuizResponse, Session } from '../types';
import { parseAppSheetDate } from './dateUtils';

export interface DataQualityCheck {
  id: string;
  category: 'completeness' | 'consistency' | 'accuracy' | 'timeliness';
  name: string;
  severity: 'error' | 'warning' | 'info';
  passed: boolean;
  affectedCount: number;
  totalCount: number;
  healthPct: number;
  examples: string[];
}

export interface DataQualityReport {
  overallHealth: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  checks: DataQualityCheck[];
  generatedAt: Date;
}

const SEV_WEIGHT: Record<string, number> = { error: 3, warning: 2, info: 1 };

/**
 * Run all 12 data quality checks and produce a report.
 */
export function runDataQualityChecks(
  employees: Employee[],
  assignments: Assignment[],
  quizResponses: QuizResponse[],
  sessions: Session[],
): DataQualityReport {
  const empSet = new Set(employees.map(e => e.EmpKey));
  const checks: DataQualityCheck[] = [];

  // 1. Missing EmpKey in assignments
  const missingEmpKey = assignments.filter(a => !a.EmpKey || a.EmpKey.trim() === '');
  checks.push(makeCheck('dq-01', 'completeness', 'Missing EmpKey in assignments', 'error',
    missingEmpKey.length, assignments.length,
    missingEmpKey.slice(0, 5).map(a => a.AssignmentID)));

  // 2. Invalid DueDate format
  const invalidDue = assignments.filter(a => a.DueDate && parseAppSheetDate(a.DueDate) === null);
  checks.push(makeCheck('dq-02', 'accuracy', 'Invalid DueDate format', 'error',
    invalidDue.length, assignments.length,
    invalidDue.slice(0, 5).map(a => `${a.AssignmentID}: "${a.DueDate}"`)));

  // 3. Duplicate AssignmentID
  const idCounts = new Map<string, number>();
  for (const a of assignments) {
    idCounts.set(a.AssignmentID, (idCounts.get(a.AssignmentID) || 0) + 1);
  }
  const dupeIds = [...idCounts.entries()].filter(([, c]) => c > 1);
  checks.push(makeCheck('dq-03', 'consistency', 'Duplicate AssignmentID', 'error',
    dupeIds.length, assignments.length,
    dupeIds.slice(0, 5).map(([id, c]) => `${id} (×${c})`)));

  // 4. Assignment EmpKey not in employee list (orphan)
  const orphanAssigns = assignments.filter(a => a.EmpKey && !empSet.has(a.EmpKey));
  checks.push(makeCheck('dq-04', 'consistency', 'Orphan assignments (EmpKey not in employees)', 'warning',
    orphanAssigns.length, assignments.length,
    orphanAssigns.slice(0, 5).map(a => `${a.AssignmentID} → ${a.EmpKey}`)));

  // 5. Employee without any assignment
  const assignedEmps = new Set(assignments.map(a => a.EmpKey));
  const noAssignment = employees.filter(e => !assignedEmps.has(e.EmpKey));
  checks.push(makeCheck('dq-05', 'completeness', 'Employees without any assignment', 'warning',
    noAssignment.length, employees.length,
    noAssignment.slice(0, 5).map(e => `${e.EmpKey} (${e.first_name} ${e.last_name})`)));

  // 6. Quiz response without matching assignment
  const assignIds = new Set(assignments.map(a => a.AssignmentID));
  const orphanQuiz = quizResponses.filter(r => r.AssignmentID && !assignIds.has(r.AssignmentID));
  checks.push(makeCheck('dq-06', 'consistency', 'Quiz responses without matching assignment', 'warning',
    orphanQuiz.length, quizResponses.length,
    orphanQuiz.slice(0, 5).map(r => `${r.ResponseID} → Assignment ${r.AssignmentID}`)));

  // 7. Session EmpKey not in employee list
  const orphanSessions = sessions.filter(s => s.LoggedInEmpKey && !empSet.has(s.LoggedInEmpKey));
  checks.push(makeCheck('dq-07', 'consistency', 'Sessions with unknown EmpKey', 'warning',
    orphanSessions.length, sessions.length,
    orphanSessions.slice(0, 5).map(s => `${s.SessionID} → ${s.LoggedInEmpKey}`)));

  // 8. Future DateAssigned
  const today = new Date();
  const futureAssigned = assignments.filter(a => {
    const d = parseAppSheetDate(a.DateAssigned);
    return d !== null && d > today;
  });
  checks.push(makeCheck('dq-08', 'accuracy', 'Assignments with future DateAssigned', 'warning',
    futureAssigned.length, assignments.length,
    futureAssigned.slice(0, 5).map(a => `${a.AssignmentID}: ${a.DateAssigned}`)));

  // 9. DueDate before DateAssigned
  const dueBeforeAssign = assignments.filter(a => {
    const assigned = parseAppSheetDate(a.DateAssigned);
    const due = parseAppSheetDate(a.DueDate);
    return assigned !== null && due !== null && due < assigned;
  });
  checks.push(makeCheck('dq-09', 'accuracy', 'DueDate before DateAssigned', 'warning',
    dueBeforeAssign.length, assignments.length,
    dueBeforeAssign.slice(0, 5).map(a => `${a.AssignmentID}: due=${a.DueDate} < assigned=${a.DateAssigned}`)));

  // 10. Empty supervisor field
  const noSupervisor = employees.filter(e => !e.supervisor || e.supervisor.trim() === '');
  checks.push(makeCheck('dq-10', 'completeness', 'Employees without supervisor', 'info',
    noSupervisor.length, employees.length,
    noSupervisor.slice(0, 5).map(e => `${e.EmpKey} (${e.first_name} ${e.last_name})`)));

  // 11. Empty department field
  const noDept = employees.filter(e => !e.department || e.department.trim() === '');
  checks.push(makeCheck('dq-11', 'completeness', 'Employees without department', 'info',
    noDept.length, employees.length,
    noDept.slice(0, 5).map(e => `${e.EmpKey} (${e.first_name} ${e.last_name})`)));

  // 12. Inactive employee with IsActive=TRUE assignment
  const inactiveEmps = new Set(
    employees.filter(e => {
      const pt = (e.perm_temp || '').trim().toUpperCase();
      return pt === 'INACTIVE' || pt === 'TERMINATED';
    }).map(e => e.EmpKey)
  );
  const activeAssignsForInactive = assignments.filter(a =>
    inactiveEmps.has(a.EmpKey) &&
    (a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true')
  );
  checks.push(makeCheck('dq-12', 'consistency', 'Inactive employees with active assignments', 'warning',
    activeAssignsForInactive.length, assignments.length,
    activeAssignsForInactive.slice(0, 5).map(a => `${a.AssignmentID} → ${a.EmpKey}`)));

  // Compute overall health
  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of checks) {
    const w = SEV_WEIGHT[c.severity] || 1;
    weightedSum += c.healthPct * w;
    weightTotal += w;
  }

  return {
    overallHealth: weightTotal > 0 ? weightedSum / weightTotal : 100,
    errorCount: checks.filter(c => c.severity === 'error' && !c.passed).length,
    warningCount: checks.filter(c => c.severity === 'warning' && !c.passed).length,
    infoCount: checks.filter(c => c.severity === 'info' && !c.passed).length,
    checks,
    generatedAt: new Date(),
  };
}

function makeCheck(
  id: string, category: DataQualityCheck['category'],
  name: string, severity: DataQualityCheck['severity'],
  affected: number, total: number, examples: string[],
): DataQualityCheck {
  const safeTotal = Math.max(total, 1);
  return {
    id, category, name, severity,
    passed: affected === 0,
    affectedCount: affected,
    totalCount: total,
    healthPct: ((safeTotal - affected) / safeTotal) * 100,
    examples,
  };
}
