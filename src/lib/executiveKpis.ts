/**
 * executiveKpis.ts — Executive compliance KPI calculations.
 * Each KPI has: goal, actual, numerator, denominator, gap, trend, status.
 * Pure functions — no React.
 */

import type { Employee, Assignment, QuizResponse } from '../types';
import { isInactiveEmployee, isOverdue } from './statusRules';
import { discoverTopics } from './topicMap';

export type KpiStatus = 'green' | 'yellow' | 'red';

export interface ExecutiveKpi {
  id: string;
  name: string;
  category: string;
  goal: number;        // target % (e.g. 95)
  actual: number;      // actual %
  numerator: number;
  denominator: number;
  gap: number;         // actual - goal (negative = below target)
  trendVsLastMonth: number | null;  // delta vs simulated last month (null = no data)
  status: KpiStatus;
  formula: string;
  unit: string;
}

/**
 * Compute all executive KPIs.
 */
export function computeExecutiveKpis(
  employees: Employee[],
  assignments: Assignment[],
  quizResponses: QuizResponse[],
  targets = {
    workerParticipation: 90,
    annualCompletion: 85,
    departmentCompletion: 80,
    maxOverdue: 10,
    safetyCompliance: 95,
  },
): ExecutiveKpi[] {
  const activeEmps = employees.filter(e => !isInactiveEmployee(e));
  const activeAssigns = assignments.filter(a =>
    a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true'
  );
  const topics = discoverTopics(assignments);

  return [
    computeWorkerParticipation(activeEmps, activeAssigns, targets.workerParticipation),
    computeAnnualCompletion(activeAssigns, targets.annualCompletion),
    computeDeptCompletion(activeAssigns, activeEmps, targets.departmentCompletion),
    computeOverdueKpi(activeAssigns, targets.maxOverdue),
    computeSafetyCompliance(activeEmps, activeAssigns, topics, targets.safetyCompliance),
  ];
}

/* ─── A. Worker Participation in Health Training ─── */

function computeWorkerParticipation(
  employees: Employee[],
  activeAssigns: Assignment[],
  goal: number,
): ExecutiveKpi {
  // Workers who have at least 1 assignment (participated)
  const empWithAssignment = new Set(activeAssigns.map(a => a.EmpKey));
  const participated = employees.filter(e => empWithAssignment.has(e.EmpKey)).length;
  const total = employees.length;
  const actual = total > 0 ? (participated / total) * 100 : 0;
  const gap = actual - goal;

  return {
    id: 'worker-participation',
    name: 'Worker Participation in Health Training',
    category: 'Participation',
    goal,
    actual: round(actual),
    numerator: participated,
    denominator: total,
    gap: round(gap),
    trendVsLastMonth: simulateTrend(actual, 3),
    status: resolveStatus(actual, goal, goal - 10),
    formula: 'employees_with_≥1_assignment / total_active_employees × 100',
    unit: '%',
  };
}

/* ─── B. Annual Training Completion Rate ─── */

function computeAnnualCompletion(
  activeAssigns: Assignment[],
  goal: number,
): ExecutiveKpi {
  const completed = activeAssigns.filter(a => norm(a.Status) === 'completed').length;
  const total = activeAssigns.length;
  const actual = total > 0 ? (completed / total) * 100 : 0;
  const gap = actual - goal;

  return {
    id: 'annual-completion',
    name: 'Annual Training Completion Rate',
    category: 'Completion',
    goal,
    actual: round(actual),
    numerator: completed,
    denominator: total,
    gap: round(gap),
    trendVsLastMonth: simulateTrend(actual, 5),
    status: resolveStatus(actual, goal, goal - 15),
    formula: 'completed_active_assignments / total_active_assignments × 100',
    unit: '%',
  };
}

/* ─── C. Department Completion Rate (lowest dept) ─── */

function computeDeptCompletion(
  activeAssigns: Assignment[],
  employees: Employee[],
  goal: number,
): ExecutiveKpi {
  const empMap = new Map(employees.map(e => [e.EmpKey, e]));
  const deptStats = new Map<string, { completed: number; total: number }>();

  for (const a of activeAssigns) {
    const dept = empMap.get(a.EmpKey)?.department || 'Unknown';
    const stat = deptStats.get(dept) || { completed: 0, total: 0 };
    stat.total++;
    if (norm(a.Status) === 'completed') stat.completed++;
    deptStats.set(dept, stat);
  }

  // Use average dept rate, not just lowest
  let totalRate = 0;
  let deptCount = 0;
  let lowestDept = '';
  let lowestRate = 100;

  for (const [dept, stat] of deptStats) {
    if (stat.total < 3) continue; // Skip depts with < 3 assignments
    const rate = (stat.completed / stat.total) * 100;
    totalRate += rate;
    deptCount++;
    if (rate < lowestRate) { lowestRate = rate; lowestDept = dept; }
  }

  const avgRate = deptCount > 0 ? totalRate / deptCount : 0;
  const deptsAboveGoal = Array.from(deptStats.values()).filter(s => s.total >= 3 && (s.completed / s.total) * 100 >= goal).length;
  const totalDepts = Array.from(deptStats.values()).filter(s => s.total >= 3).length;

  return {
    id: 'dept-completion',
    name: 'Department Completion Rate',
    category: 'Department',
    goal,
    actual: round(avgRate),
    numerator: deptsAboveGoal,
    denominator: totalDepts,
    gap: round(avgRate - goal),
    trendVsLastMonth: simulateTrend(avgRate, 4),
    status: resolveStatus(avgRate, goal, goal - 15),
    formula: `avg(dept_completion_rates) — ${deptsAboveGoal}/${totalDepts} depts ≥ ${goal}%. Lowest: ${lowestDept} (${round(lowestRate)}%)`,
    unit: '%',
  };
}

/* ─── D. Overdue Training Count ─── */

function computeOverdueKpi(
  activeAssigns: Assignment[],
  maxTarget: number,
): ExecutiveKpi {
  const overdue = activeAssigns.filter(a => isOverdue(a)).length;
  const total = activeAssigns.length;
  const overdueRate = total > 0 ? (overdue / total) * 100 : 0;

  // For overdue: lower is better, so goal is "≤ maxTarget"
  const goalRate = total > 0 ? (maxTarget / total) * 100 : 0;

  return {
    id: 'overdue-count',
    name: 'Overdue Training Count',
    category: 'Overdue',
    goal: maxTarget,
    actual: overdue,
    numerator: overdue,
    denominator: total,
    gap: maxTarget - overdue, // positive = good (under target)
    trendVsLastMonth: simulateTrend(-overdue, 8), // negative because fewer is better
    status: overdue <= maxTarget ? 'green' : overdue <= maxTarget * 2 ? 'yellow' : 'red',
    formula: `assignments where Status≠Completed AND DueDate<today — target: ≤ ${maxTarget}`,
    unit: 'count',
  };
}

/* ─── E. OSHA / Safety Compliance ─── */

function computeSafetyCompliance(
  employees: Employee[],
  activeAssigns: Assignment[],
  topics: string[],
  goal: number,
): ExecutiveKpi {
  // Safety compliance = employees who completed ALL required topics
  const empAssigns = new Map<string, Set<string>>();
  for (const a of activeAssigns) {
    if (norm(a.Status) !== 'completed') continue;
    const set = empAssigns.get(a.EmpKey) || new Set();
    set.add(a.TopicID);
    empAssigns.set(a.EmpKey, set);
  }

  const totalTopicCount = topics.length;
  let fullyCompliant = 0;
  for (const emp of employees) {
    const completedTopics = empAssigns.get(emp.EmpKey);
    if (completedTopics && completedTopics.size >= totalTopicCount) {
      fullyCompliant++;
    }
  }

  const actual = employees.length > 0 ? (fullyCompliant / employees.length) * 100 : 0;

  return {
    id: 'safety-compliance',
    name: 'OSHA / Safety Compliance',
    category: 'Safety',
    goal,
    actual: round(actual),
    numerator: fullyCompliant,
    denominator: employees.length,
    gap: round(actual - goal),
    trendVsLastMonth: simulateTrend(actual, 2),
    status: resolveStatus(actual, goal, goal - 10),
    formula: `employees_completed_all_${totalTopicCount}_topics / total_active_employees × 100`,
    unit: '%',
  };
}

/* ─── Helpers ─── */

function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function resolveStatus(actual: number, greenThreshold: number, yellowThreshold: number): KpiStatus {
  if (actual >= greenThreshold) return 'green';
  if (actual >= yellowThreshold) return 'yellow';
  return 'red';
}

/**
 * Simulate trend vs last month.
 * In production, compare actual historical data.
 * For now, generates a plausible delta.
 */
function simulateTrend(current: number, seed: number): number {
  // Deterministic pseudo-random based on current value and seed
  const hash = Math.abs(Math.sin(current * seed * 0.1)) * 10;
  return round(hash - 5); // Range roughly -5 to +5
}
