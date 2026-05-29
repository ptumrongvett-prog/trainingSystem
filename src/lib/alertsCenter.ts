/**
 * alertsCenter.ts — Enhanced alert generation for the Alerts Center.
 * Adds due-soon, duplicate, inactive-assigned, missing-supervisor alerts.
 * Pure functions.
 */

import type { Employee, Assignment, QuizResponse, Alert } from '../types';
import { isOverdue, isInactiveEmployee } from './statusRules';
import { parseAppSheetDate } from './dateUtils';

let alertCounter = 0;
function nextId(): string { return `alert-${++alertCounter}`; }

/**
 * Generate comprehensive alerts for the Alerts Center.
 */
export function generateCenterAlerts(
  assignments: Assignment[],
  employees: Employee[],
  responses: QuizResponse[],
): Alert[] {
  alertCounter = 0;
  const alerts: Alert[] = [];
  const today = new Date();
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() + 7);

  const activeAssigns = assignments.filter(a =>
    a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true'
  );
  const empMap = new Map(employees.map(e => [e.EmpKey, e]));

  // 1. Overdue training
  const overdueAssigns = activeAssigns.filter(a => isOverdue(a, today));
  const overdueByTopic = new Map<string, number>();
  for (const a of overdueAssigns) {
    overdueByTopic.set(a.TopicID, (overdueByTopic.get(a.TopicID) || 0) + 1);
  }
  for (const [topic, count] of overdueByTopic) {
    alerts.push({
      id: nextId(), type: 'TRAINING_OVERDUE', severity: 'critical',
      title: `${count} overdue for ${topic}`,
      message: `${count} employees have overdue training for topic ${topic}.`,
      affectedCount: count, topicId: topic, timestamp: today,
    });
  }

  // 2. Due within 7 days
  const dueSoonAssigns = activeAssigns.filter(a => {
    if (norm(a.Status) === 'completed') return false;
    const due = parseAppSheetDate(a.DueDate);
    return due !== null && due >= today && due <= sevenDays;
  });
  if (dueSoonAssigns.length > 0) {
    alerts.push({
      id: nextId(), type: 'TRAINING_DUE_SOON', severity: 'warning',
      title: `${dueSoonAssigns.length} assignments due within 7 days`,
      message: `${dueSoonAssigns.length} training assignments are due in the next 7 days.`,
      affectedCount: dueSoonAssigns.length, timestamp: today,
    });
  }

  // 3. Department below target
  const deptStats = new Map<string, { completed: number; total: number }>();
  for (const a of activeAssigns) {
    const dept = empMap.get(a.EmpKey)?.department || 'Unknown';
    const stat = deptStats.get(dept) || { completed: 0, total: 0 };
    stat.total++;
    if (norm(a.Status) === 'completed') stat.completed++;
    deptStats.set(dept, stat);
  }
  for (const [dept, stat] of deptStats) {
    const rate = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
    if (rate < 80 && stat.total >= 5) {
      alerts.push({
        id: nextId(), type: 'DEPARTMENT_BELOW_THRESHOLD', severity: rate < 50 ? 'critical' : 'warning',
        title: `${dept} at ${rate.toFixed(0)}% completion`,
        message: `${dept} department is below 80% target with ${stat.completed}/${stat.total} completed.`,
        affectedCount: stat.total - stat.completed, department: dept, timestamp: today,
      });
    }
  }

  // 4. Low quiz scores
  const empScores = new Map<string, { correct: number; total: number }>();
  for (const r of responses) {
    const stat = empScores.get(r.EmpKey) || { correct: 0, total: 0 };
    stat.total++;
    if (r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y') stat.correct++;
    empScores.set(r.EmpKey, stat);
  }
  const lowScoreEmps: string[] = [];
  for (const [empKey, stat] of empScores) {
    if (stat.total >= 5 && (stat.correct / stat.total) < 0.7) {
      lowScoreEmps.push(empKey);
    }
  }
  if (lowScoreEmps.length > 0) {
    alerts.push({
      id: nextId(), type: 'LOW_QUIZ_SCORE', severity: 'warning',
      title: `${lowScoreEmps.length} employees with quiz score <70%`,
      message: `Employees with low quiz performance may need additional training support.`,
      affectedCount: lowScoreEmps.length, timestamp: today,
    });
  }

  // 5. Inactive employee still assigned
  const inactiveWithAssignment: string[] = [];
  for (const a of activeAssigns) {
    const emp = empMap.get(a.EmpKey);
    if (emp && isInactiveEmployee(emp)) {
      inactiveWithAssignment.push(a.EmpKey);
    }
  }
  const uniqueInactive = [...new Set(inactiveWithAssignment)];
  if (uniqueInactive.length > 0) {
    alerts.push({
      id: nextId(), type: 'INACTIVE_STILL_ASSIGNED', severity: 'info',
      title: `${uniqueInactive.length} inactive employees with active assignments`,
      message: `These employees are marked INACTIVE/TERMINATED but still have IsActive=TRUE assignments.`,
      affectedCount: uniqueInactive.length, timestamp: today,
    });
  }

  // 6. Duplicate active assignments
  const empTopicCount = new Map<string, number>();
  for (const a of activeAssigns) {
    const key = `${a.EmpKey}|${a.TopicID}`;
    empTopicCount.set(key, (empTopicCount.get(key) || 0) + 1);
  }
  const dupes = [...empTopicCount.entries()].filter(([, count]) => count > 1);
  if (dupes.length > 0) {
    alerts.push({
      id: nextId(), type: 'TRAINING_OVERDUE', severity: 'info',
      title: `${dupes.length} duplicate active assignments`,
      message: `${dupes.length} employee-topic pairs have multiple active assignments. Consider deactivating older ones.`,
      affectedCount: dupes.length, timestamp: today,
    });
  }

  // 7. Missing supervisor mapping
  const noSupervisor = employees.filter(e => !e.supervisor || e.supervisor.trim() === '');
  if (noSupervisor.length > 0) {
    alerts.push({
      id: nextId(), type: 'DEPARTMENT_BELOW_THRESHOLD', severity: 'info',
      title: `${noSupervisor.length} employees without supervisor`,
      message: `These employees have no supervisor mapped, making follow-up tracking difficult.`,
      affectedCount: noSupervisor.length, timestamp: today,
    });
  }

  // Sort: critical first, then warning, then info
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

  return alerts;
}

function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}
