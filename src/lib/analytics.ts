/**
 * analytics.ts — All KPI and analytics calculations.
 * Pure functions only. No React, no side effects, no API calls.
 * Components call these with pre-loaded data.
 */

import type {
  Employee, Assignment, QuizResponse, QuizQuestion,
  AnalyticsSnapshot, DepartmentStat, DivisionStat, TopicStat,
  SupervisorStat, MissingTraining,
} from '../types';
import { parseAppSheetDate, isPast, getWeekRange } from './dateUtils';
import { isOverdue, isInactiveEmployee } from './statusRules';
import { getTopicName, discoverTopics, getRequiredTopicsForDept } from './topicMap';

/* ─── Main Snapshot Builder ─── */

export function buildAnalyticsSnapshot(
  employees: Employee[],
  assignments: Assignment[],
  quizResponses: QuizResponse[],
  quizQuestions: QuizQuestion[],
  today: Date = new Date(),
): AnalyticsSnapshot {
  const activeEmployees = employees.filter(e => !isInactiveEmployee(e));
  const activeAssignments = assignments.filter(a => a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true');
  const topics = discoverTopics(assignments);

  const { rate: completionRate, completed: completedCount, total: totalAssignments } = computeCompletionRate(activeAssignments);
  const overdueCount = computeOverdueCount(activeAssignments, today);
  const departmentBreakdown = computeDepartmentBreakdown(activeAssignments, activeEmployees);
  const highRiskDepartments = departmentBreakdown.filter(d => d.rate < 0.8);
  const missingRequired = computeMissingRequired(activeAssignments, activeEmployees);
  const { overall: avgQuizScore } = computeAverageQuizScore(quizResponses);
  const mostFailedTopic = computeMostFailedTopic(quizResponses, quizQuestions);
  const weeklyCompleted = computeWeeklyCompleted(activeAssignments, today);
  const divisionBreakdown = computeDivisionBreakdown(activeAssignments, activeEmployees);
  const topicBreakdown = computeTopicBreakdown(activeAssignments, topics, today);
  const supervisorSummary = computeSupervisorSummary(activeAssignments, activeEmployees, today);

  return {
    completionRate,
    overdueCount,
    highRiskDepartments,
    missingRequired,
    avgQuizScore,
    mostFailedTopic,
    weeklyCompleted,
    departmentBreakdown,
    divisionBreakdown,
    topicBreakdown,
    supervisorSummary,
    totalEmployees: activeEmployees.length,
    totalTopics: topics.length,
    totalAssignments,
  };
}

/* ─── Individual KPI Functions ─── */

export function computeCompletionRate(assignments: Assignment[]): { rate: number; completed: number; total: number } {
  if (assignments.length === 0) return { rate: 0, completed: 0, total: 0 };
  const completed = assignments.filter(a => norm(a.Status) === 'completed').length;
  return { rate: completed / assignments.length, completed, total: assignments.length };
}

export function computeOverdueCount(assignments: Assignment[], today: Date = new Date()): number {
  return assignments.filter(a => isOverdue(a, today)).length;
}

export function computeHighRiskDepartments(
  assignments: Assignment[],
  employees: Employee[],
  threshold = 0.8,
): DepartmentStat[] {
  return computeDepartmentBreakdown(assignments, employees).filter(d => d.rate < threshold);
}

export function computeMissingRequired(
  assignments: Assignment[],
  employees: Employee[],
): MissingTraining[] {
  const result: MissingTraining[] = [];
  const empAssignments = groupByEmpKey(assignments);

  for (const emp of employees) {
    const required = getRequiredTopicsForDept(emp.department);
    const empA = empAssignments.get(emp.EmpKey) || [];
    const completedTopics = new Set(
      empA.filter(a => norm(a.Status) === 'completed').map(a => a.TopicID)
    );
    const missing = required.filter(t => !completedTopics.has(t));
    if (missing.length > 0) {
      result.push({
        empKey: emp.EmpKey,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        department: emp.department,
        missingTopics: missing,
      });
    }
  }

  return result;
}

export function computeAverageQuizScore(
  responses: QuizResponse[],
): { overall: number; byTopic: Map<string, number> } {
  if (responses.length === 0) return { overall: 0, byTopic: new Map() };

  let totalCorrect = 0;
  const byTopic = new Map<string, number>();

  for (const r of responses) {
    const correct = r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y';
    if (correct) totalCorrect++;
  }

  return {
    overall: (totalCorrect / responses.length) * 100,
    byTopic,
  };
}

export function computeMostFailedTopic(
  responses: QuizResponse[],
  questions: QuizQuestion[],
): { topicId: string; name: string; failRate: number } {
  if (responses.length === 0 || questions.length === 0) {
    return { topicId: '', name: 'N/A', failRate: 0 };
  }

  // Build QuestionID → TopicID map
  const qMap = new Map<string, string>();
  for (const q of questions) {
    qMap.set(q.QuestionID, q.TopicID);
  }

  // Count fails per topic
  const topicStats = new Map<string, { fail: number; total: number }>();
  for (const r of responses) {
    const topicId = qMap.get(r.QuestionID);
    if (!topicId) continue;
    const stat = topicStats.get(topicId) || { fail: 0, total: 0 };
    stat.total++;
    const correct = r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y';
    if (!correct) stat.fail++;
    topicStats.set(topicId, stat);
  }

  let worst = { topicId: '', name: 'N/A', failRate: 0 };
  for (const [topicId, stat] of topicStats) {
    const failRate = stat.total > 0 ? stat.fail / stat.total : 0;
    if (failRate > worst.failRate) {
      worst = { topicId, name: getTopicName(topicId), failRate };
    }
  }

  return worst;
}

export function computeWeeklyCompleted(assignments: Assignment[], today: Date = new Date()): number {
  const { start, end } = getWeekRange(today);
  return assignments.filter(a => {
    if (norm(a.Status) !== 'completed') return false;
    // Use DueDate as proxy for completion date (AppSheet doesn't have a separate completion_date)
    const d = parseAppSheetDate(a.DueDate) || parseAppSheetDate(a.DateAssigned);
    if (!d) return false;
    return d >= start && d <= end;
  }).length;
}

export function computeDepartmentBreakdown(
  assignments: Assignment[],
  employees: Employee[],
): DepartmentStat[] {
  const empMap = new Map<string, Employee>();
  for (const e of employees) empMap.set(e.EmpKey, e);

  const deptStats = new Map<string, { completed: number; total: number; overdue: number }>();

  for (const a of assignments) {
    const emp = empMap.get(a.EmpKey);
    const dept = emp?.department || 'Unknown';
    const stat = deptStats.get(dept) || { completed: 0, total: 0, overdue: 0 };
    stat.total++;
    if (norm(a.Status) === 'completed') stat.completed++;
    if (isOverdue(a)) stat.overdue++;
    deptStats.set(dept, stat);
  }

  return Array.from(deptStats.entries())
    .filter(([department]) => department !== 'Unknown')
    .map(([department, stat]) => ({
    department,
    completed: stat.completed,
    total: stat.total,
    rate: stat.total > 0 ? stat.completed / stat.total : 0,
    overdue: stat.overdue,
  })).sort((a, b) => a.rate - b.rate);
}

export function computeDivisionBreakdown(
  assignments: Assignment[],
  employees: Employee[],
): DivisionStat[] {
  const empMap = new Map<string, Employee>();
  for (const e of employees) empMap.set(e.EmpKey, e);

  const divStats = new Map<string, { completed: number; total: number }>();

  for (const a of assignments) {
    const emp = empMap.get(a.EmpKey);
    const div = emp?.division || 'Unknown';
    const stat = divStats.get(div) || { completed: 0, total: 0 };
    stat.total++;
    if (norm(a.Status) === 'completed') stat.completed++;
    divStats.set(div, stat);
  }

  return Array.from(divStats.entries()).map(([division, stat]) => ({
    division,
    completed: stat.completed,
    total: stat.total,
    rate: stat.total > 0 ? stat.completed / stat.total : 0,
  }));
}

export function computeTopicBreakdown(
  assignments: Assignment[],
  topicIds: string[],
  today: Date = new Date(),
): TopicStat[] {
  const topicStats = new Map<string, { assigned: number; completed: number; overdue: number; pending: number }>();

  for (const id of topicIds) {
    topicStats.set(id, { assigned: 0, completed: 0, overdue: 0, pending: 0 });
  }

  for (const a of assignments) {
    const stat = topicStats.get(a.TopicID) || { assigned: 0, completed: 0, overdue: 0, pending: 0 };
    stat.assigned++;
    if (norm(a.Status) === 'completed') {
      stat.completed++;
    } else if (isOverdue(a, today)) {
      stat.overdue++;
    } else {
      stat.pending++;
    }
    topicStats.set(a.TopicID, stat);
  }

  return Array.from(topicStats.entries()).map(([topicId, stat]) => ({
    topicId,
    name: getTopicName(topicId),
    assigned: stat.assigned,
    completed: stat.completed,
    overdue: stat.overdue,
    pending: stat.pending,
    rate: stat.assigned > 0 ? stat.completed / stat.assigned : 0,
  })).sort((a, b) => a.rate - b.rate);
}

export function computeSupervisorSummary(
  assignments: Assignment[],
  employees: Employee[],
  today: Date = new Date(),
): SupervisorStat[] {
  // Group employees by supervisor
  const supervisorGroups = new Map<string, Employee[]>();
  for (const e of employees) {
    const sup = e.supervisor || 'Unassigned';
    const group = supervisorGroups.get(sup) || [];
    group.push(e);
    supervisorGroups.set(sup, group);
  }

  const empAssignments = groupByEmpKey(assignments);
  const result: SupervisorStat[] = [];

  for (const [supervisor, emps] of supervisorGroups) {
    let missingCount = 0;
    let overdueCount = 0;
    const empKeys: string[] = [];

    for (const emp of emps) {
      empKeys.push(emp.EmpKey);
      const empA = empAssignments.get(emp.EmpKey) || [];
      const overdue = empA.filter(a => isOverdue(a, today)).length;
      overdueCount += overdue;

      const required = getRequiredTopicsForDept(emp.department);
      const completedTopics = new Set(
        empA.filter(a => norm(a.Status) === 'completed').map(a => a.TopicID)
      );
      missingCount += required.filter(t => !completedTopics.has(t)).length;
    }

    result.push({
      supervisor,
      employeeCount: emps.length,
      missingCount,
      overdueCount,
      employees: empKeys,
    });
  }

  return result.sort((a, b) => b.overdueCount - a.overdueCount);
}

/* ─── Helpers ─── */

function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

function groupByEmpKey(assignments: Assignment[]): Map<string, Assignment[]> {
  const map = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const arr = map.get(a.EmpKey) || [];
    arr.push(a);
    map.set(a.EmpKey, arr);
  }
  return map;
}
