/**
 * validators.ts — Data validation layer.
 * Run before analytics to catch bad data from AppSheet/Google Sheets.
 */

import type { Employee, Assignment, QuizResponse, ValidationIssue } from '../types';
import { parseAppSheetDate } from './dateUtils';
import { getAllTopicIds } from './topicMap';

/**
 * Validate all imported data and return issues.
 * Issues are categorized and have severity levels.
 */
export function validateAllData(
  employees: Employee[],
  assignments: Assignment[],
  quizResponses: QuizResponse[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  issues.push(...validateEmployees(employees));
  issues.push(...validateAssignments(assignments, employees));
  issues.push(...validateQuizResponses(quizResponses, assignments));

  return issues;
}

/** Validate employee records */
export function validateEmployees(employees: Employee[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenKeys = new Set<string>();

  for (const e of employees) {
    // Missing EmpKey
    if (!e.EmpKey || !e.EmpKey.trim()) {
      issues.push({
        category: 'Employees without EmpKey',
        severity: 'error',
        message: `Employee "${e.first_name} ${e.last_name}" (${e.employee_number}) has no EmpKey`,
        recordId: e.employee_number,
        field: 'EmpKey',
      });
      continue;
    }

    // Duplicate EmpKey
    if (seenKeys.has(e.EmpKey)) {
      issues.push({
        category: 'Duplicate EmpKey',
        severity: 'error',
        message: `Duplicate EmpKey: ${e.EmpKey} for "${e.first_name} ${e.last_name}"`,
        recordId: e.EmpKey,
        field: 'EmpKey',
      });
    }
    seenKeys.add(e.EmpKey);

    // Missing supervisor
    if (!e.supervisor || !e.supervisor.trim()) {
      issues.push({
        category: 'Employees without supervisor',
        severity: 'warning',
        message: `Employee "${e.first_name} ${e.last_name}" (${e.EmpKey}) has no supervisor`,
        recordId: e.EmpKey,
        field: 'supervisor',
      });
    }
  }

  return issues;
}

/** Validate assignment records */
export function validateAssignments(assignments: Assignment[], employees: Employee[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const empKeySet = new Set(employees.map(e => e.EmpKey));
  const seenIds = new Set<string>();
  const activeByEmpTopic = new Map<string, string[]>();

  for (const a of assignments) {
    // Missing EmpKey
    if (!a.EmpKey || !a.EmpKey.trim()) {
      issues.push({
        category: 'Assignments without EmpKey',
        severity: 'error',
        message: `Assignment ${a.AssignmentID} has no EmpKey`,
        recordId: a.AssignmentID,
        field: 'EmpKey',
      });
    }

    // EmpKey not found in employees
    if (a.EmpKey && !empKeySet.has(a.EmpKey)) {
      issues.push({
        category: 'Assignments without matching employee',
        severity: 'warning',
        message: `Assignment ${a.AssignmentID}: EmpKey "${a.EmpKey}" not found in Employees`,
        recordId: a.AssignmentID,
        field: 'EmpKey',
      });
    }

    // Invalid DueDate
    if (a.DueDate && !parseAppSheetDate(a.DueDate)) {
      issues.push({
        category: 'Invalid DueDate',
        severity: 'warning',
        message: `Assignment ${a.AssignmentID} has invalid DueDate: "${a.DueDate}"`,
        recordId: a.AssignmentID,
        field: 'DueDate',
      });
    }

    // Missing DueDate
    if (!a.DueDate || !a.DueDate.trim()) {
      issues.push({
        category: 'Missing DueDate',
        severity: 'warning',
        message: `Assignment ${a.AssignmentID} for ${a.EmpKey} has no DueDate`,
        recordId: a.AssignmentID,
        field: 'DueDate',
      });
    }

    // Invalid Status
    const validStatuses = ['completed', 'assigned', 'pending', 'overdue', ''];
    const normStatus = (a.Status || '').trim().toLowerCase();
    if (normStatus && !validStatuses.includes(normStatus)) {
      issues.push({
        category: 'Invalid Status',
        severity: 'warning',
        message: `Assignment ${a.AssignmentID} has unknown status: "${a.Status}"`,
        recordId: a.AssignmentID,
        field: 'Status',
      });
    }

    // Duplicate AssignmentID
    if (seenIds.has(a.AssignmentID)) {
      issues.push({
        category: 'Duplicate AssignmentID',
        severity: 'error',
        message: `Duplicate AssignmentID: ${a.AssignmentID}`,
        recordId: a.AssignmentID,
        field: 'AssignmentID',
      });
    }
    seenIds.add(a.AssignmentID);

    // Unknown TopicID
    const knownTopics = getAllTopicIds();
    if (a.TopicID && !knownTopics.includes(a.TopicID)) {
      issues.push({
        category: 'Unknown TopicID',
        severity: 'warning',
        message: `Assignment ${a.AssignmentID} references unknown topic: "${a.TopicID}"`,
        recordId: a.AssignmentID,
        field: 'TopicID',
      });
    }

    // Duplicate active assignments (same emp + topic)
    const isActive = a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true';
    if (isActive && a.EmpKey && a.TopicID) {
      const key = `${a.EmpKey}|${a.TopicID}`;
      const existing = activeByEmpTopic.get(key) || [];
      existing.push(a.AssignmentID);
      activeByEmpTopic.set(key, existing);
    }

    // Completed but missing completion date (heuristic: completed + no DueDate)
    if (normStatus === 'completed' && (!a.DueDate || !a.DueDate.trim())) {
      issues.push({
        category: 'Completed but missing date',
        severity: 'warning',
        message: `Assignment ${a.AssignmentID} is completed but has no DueDate`,
        recordId: a.AssignmentID,
        field: 'DueDate',
      });
    }
  }

  // Check for inactive employees with active assignments
  for (const e of employees) {
    const pt = (e.perm_temp || '').trim().toUpperCase();
    if (pt === 'INACTIVE' || pt === 'TERMINATED') {
      const empAssigns = assignments.filter(
        a => a.EmpKey === e.EmpKey && (a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true')
      );
      if (empAssigns.length > 0) {
        issues.push({
          category: 'Inactive employee with active assignment',
          severity: 'warning',
          message: `Inactive employee "${e.first_name} ${e.last_name}" (${e.EmpKey}) has ${empAssigns.length} active assignments`,
          recordId: e.EmpKey,
        });
      }
    }
  }

  // Report duplicate active assignments
  for (const [key, ids] of activeByEmpTopic) {
    if (ids.length > 1) {
      issues.push({
        category: 'Duplicate active assignments',
        severity: 'warning',
        message: `Employee+Topic ${key} has ${ids.length} active assignments: ${ids.join(', ')}`,
        recordId: ids[0],
      });
    }
  }

  return issues;
}

/** Validate quiz response records */
export function validateQuizResponses(responses: QuizResponse[], assignments: Assignment[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const assignIds = new Set(assignments.map(a => a.AssignmentID));

  for (const r of responses) {
    if (r.AssignmentID && !assignIds.has(r.AssignmentID)) {
      issues.push({
        category: 'QuizResponses without matching assignment',
        severity: 'warning',
        message: `QuizResponse ${r.ResponseID} references unknown assignment: "${r.AssignmentID}"`,
        recordId: r.ResponseID,
        field: 'AssignmentID',
      });
    }
  }

  return issues;
}

/** Get summary of validation issues by category */
export function getValidationSummary(issues: ValidationIssue[]): { category: string; count: number; severity: string }[] {
  const map = new Map<string, { count: number; severity: string }>();
  for (const issue of issues) {
    const existing = map.get(issue.category) || { count: 0, severity: issue.severity };
    existing.count++;
    if (issue.severity === 'error') existing.severity = 'error'; // Escalate to error if any error
    map.set(issue.category, existing);
  }
  return Array.from(map.entries())
    .map(([category, stat]) => ({ category, ...stat }))
    .sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1));
}
