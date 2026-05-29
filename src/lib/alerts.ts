/**
 * alerts.ts — Smart alert generation.
 * Generates alerts from analytics data. No React dependencies.
 */

import type { Alert, AlertType, AlertSeverity, Assignment, Employee, QuizResponse } from '../types';
import { isOverdue } from './statusRules';
import { parseAppSheetDate, isWithinDays } from './dateUtils';
import { getTopicName } from './topicMap';
import { computeDepartmentBreakdown, computeAverageQuizScore } from './analytics';

let alertCounter = 0;
function nextId(): string {
  return `alert-${++alertCounter}-${Date.now()}`;
}

/**
 * Generate all smart alerts from current data.
 */
export function generateAlerts(
  assignments: Assignment[],
  employees: Employee[],
  responses: QuizResponse[],
  today: Date = new Date(),
  thresholds = { deptCompletion: 0.8, quizScore: 70, dueSoonDays: 7 },
): Alert[] {
  const alerts: Alert[] = [];

  alerts.push(...alertDueSoon(assignments, today, thresholds.dueSoonDays));
  alerts.push(...alertOverdue(assignments, today));
  alerts.push(...alertLowQuizScore(responses, thresholds.quizScore));
  alerts.push(...alertDeptBelowThreshold(assignments, employees, thresholds.deptCompletion));
  alerts.push(...alertInactiveAssigned(assignments, employees));

  // Sort by severity: critical first
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

function alertDueSoon(assignments: Assignment[], today: Date, days: number): Alert[] {
  const dueSoon = assignments.filter(a => {
    if ((a.Status || '').toLowerCase() === 'completed') return false;
    const due = parseAppSheetDate(a.DueDate);
    return due && isWithinDays(due, days, today);
  });

  if (dueSoon.length === 0) return [];

  return [{
    id: nextId(),
    type: 'TRAINING_DUE_SOON',
    severity: 'warning',
    title: `${dueSoon.length} training${dueSoon.length > 1 ? 's' : ''} due within ${days} days`,
    message: `${dueSoon.length} assignment(s) are due within the next ${days} days and need attention.`,
    relatedIds: dueSoon.map(a => a.AssignmentID),
    timestamp: today,
  }];
}

function alertOverdue(assignments: Assignment[], today: Date): Alert[] {
  // Group by topic → count completed, total, and overdue
  const topicStats = new Map<string, { completed: number; total: number; overdue: number }>();
  for (const a of assignments) {
    const stat = topicStats.get(a.TopicID) || { completed: 0, total: 0, overdue: 0 };
    stat.total++;
    if ((a.Status || '').toLowerCase() === 'completed') stat.completed++;
    if (isOverdue(a, today)) stat.overdue++;
    topicStats.set(a.TopicID, stat);
  }

  const threshold = 0.95;
  const belowThreshold = Array.from(topicStats.entries())
    .map(([id, stat]) => ({ id, rate: stat.total > 0 ? stat.completed / stat.total : 0, completed: stat.completed, total: stat.total, overdue: stat.overdue }))
    .filter(t => t.rate < threshold && t.total > 0 && t.overdue > 0)
    .sort((a, b) => a.rate - b.rate);

  if (belowThreshold.length === 0) return [];

  const topicList = belowThreshold
    .map(t => `${getTopicName(t.id)}: ${(t.rate * 100).toFixed(0)}% (${t.overdue} overdue)`)
    .join(', ');

  return [{
    id: nextId(),
    type: 'TRAINING_OVERDUE',
    severity: 'critical',
    title: `${belowThreshold.length} overdue topic${belowThreshold.length > 1 ? 's' : ''} below 95% completion`,
    message: `${topicList}`,
    relatedIds: belowThreshold.map(t => t.id),
    timestamp: today,
  }];
}

function alertLowQuizScore(responses: QuizResponse[], threshold: number): Alert[] {
  const { overall } = computeAverageQuizScore(responses);
  if (responses.length === 0 || overall >= threshold) return [];

  return [{
    id: nextId(),
    type: 'LOW_QUIZ_SCORE',
    severity: 'warning',
    title: `Average quiz score below ${threshold}%`,
    message: `Overall average quiz score is ${overall.toFixed(1)}%, below the ${threshold}% threshold.`,
    relatedIds: [],
    timestamp: new Date(),
  }];
}

function alertDeptBelowThreshold(
  assignments: Assignment[],
  employees: Employee[],
  threshold: number,
): Alert[] {
  const breakdown = computeDepartmentBreakdown(assignments, employees);
  const atRisk = breakdown.filter(d => d.total > 0 && d.rate < threshold);

  if (atRisk.length === 0) return [];

  const deptList = atRisk.map(d => `${d.department} (${(d.rate * 100).toFixed(0)}%)`).join(', ');

  return [{
    id: nextId(),
    type: 'DEPARTMENT_BELOW_THRESHOLD',
    severity: atRisk.some(d => d.rate < 0.5) ? 'critical' : 'warning',
    title: `${atRisk.length} department${atRisk.length > 1 ? 's' : ''} below ${(threshold * 100).toFixed(0)}% completion`,
    message: deptList,
    relatedIds: atRisk.map(d => d.department),
    timestamp: new Date(),
  }];
}

function alertInactiveAssigned(assignments: Assignment[], employees: Employee[]): Alert[] {
  const inactiveKeys = new Set(
    employees
      .filter(e => {
        const pt = (e.perm_temp || '').toUpperCase();
        return pt === 'INACTIVE' || pt === 'TERMINATED';
      })
      .map(e => e.EmpKey)
  );

  const activeAssigns = assignments.filter(a => {
    const isActive = a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true';
    return isActive && inactiveKeys.has(a.EmpKey);
  });

  if (activeAssigns.length === 0) return [];

  return [{
    id: nextId(),
    type: 'INACTIVE_STILL_ASSIGNED',
    severity: 'info',
    title: `${activeAssigns.length} active assignment${activeAssigns.length > 1 ? 's' : ''} for inactive employees`,
    message: `Inactive/terminated employees still have active training assignments that should be deactivated.`,
    relatedIds: activeAssigns.map(a => a.AssignmentID),
    timestamp: new Date(),
  }];
}
