/**
 * riskScoring.ts — Per-employee compliance risk scoring.
 * 5-factor weighted formula producing 0–100 score.
 * Pure functions. Additive only (Phase 5).
 */

import type { Employee, Assignment, QuizResponse, Session } from '../types';
import { isOverdue } from './statusRules';
import { parseAppSheetDate } from './dateUtils';

export interface RiskFactor {
  name: string;
  weight: number;
  rawValue: number;
  contribution: number;
}

export interface EmployeeRisk {
  empKey: string;
  name: string;
  department: string;
  division: string;
  supervisor: string;
  shift: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  overdueCount: number;
  completionRate: number;
  avgQuizScore: number;
  missingTopicCount: number;
  daysSinceLogin: number;
}

const WEIGHTS = {
  overdue: 35,
  completion: 25,
  quiz: 15,
  inactivity: 15,
  missing: 10,
};

/**
 * Compute risk profiles for all employees.
 */
export function computeRiskScores(
  employees: Employee[],
  assignments: Assignment[],
  quizResponses: QuizResponse[],
  sessions: Session[],
  topicIds: string[],
): EmployeeRisk[] {
  const today = new Date();

  const activeAssigns = assignments.filter(a =>
    a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true'
  );

  // Pre-group assignments by EmpKey
  const empAssigns = new Map<string, Assignment[]>();
  for (const a of activeAssigns) {
    const list = empAssigns.get(a.EmpKey) || [];
    list.push(a);
    empAssigns.set(a.EmpKey, list);
  }

  // Pre-group quiz responses by EmpKey
  const empQuiz = new Map<string, { correct: number; total: number }>();
  for (const r of quizResponses) {
    const stat = empQuiz.get(r.EmpKey) || { correct: 0, total: 0 };
    stat.total++;
    if (r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y') stat.correct++;
    empQuiz.set(r.EmpKey, stat);
  }

  // Pre-compute last login per EmpKey
  const lastLogin = new Map<string, Date>();
  for (const s of sessions) {
    const d = parseAppSheetDate(s.LoggedInAt);
    if (!d) continue;
    const existing = lastLogin.get(s.LoggedInEmpKey);
    if (!existing || d > existing) lastLogin.set(s.LoggedInEmpKey, d);
  }

  const totalTopics = topicIds.length || 1;
  const results: EmployeeRisk[] = [];

  for (const emp of employees) {
    const assigns = empAssigns.get(emp.EmpKey) || [];
    const completed = assigns.filter(a => (a.Status || '').toLowerCase() === 'completed').length;
    const overdue = assigns.filter(a => isOverdue(a, today)).length;
    const completionRate = assigns.length > 0 ? completed / assigns.length : 0;

    const quiz = empQuiz.get(emp.EmpKey);
    const avgQuizScore = quiz && quiz.total > 0 ? quiz.correct / quiz.total : 0;
    const hasQuizData = quiz !== undefined && quiz.total > 0;

    const login = lastLogin.get(emp.EmpKey);
    const daysSinceLogin = login
      ? Math.floor((today.getTime() - login.getTime()) / 86400000)
      : 90; // default 90 days if never logged in

    const assignedTopics = new Set(assigns.map(a => a.TopicID));
    const missingTopicCount = topicIds.filter(t => !assignedTopics.has(t)).length;

    // Calculate factors
    const factors: RiskFactor[] = [
      makeFactor('Overdue Training', WEIGHTS.overdue, Math.min(overdue / 3, 1.0)),
      makeFactor('Incomplete Training', WEIGHTS.completion, 1 - completionRate),
      makeFactor('Quiz Performance', WEIGHTS.quiz, hasQuizData ? 1 - avgQuizScore : 0),
      makeFactor('Inactivity', WEIGHTS.inactivity, Math.min(daysSinceLogin / 30, 1.0)),
      makeFactor('Missing Topics', WEIGHTS.missing, Math.min(missingTopicCount / Math.max(totalTopics, 1), 1.0)),
    ];

    const riskScore = Math.min(100, Math.max(0,
      factors.reduce((sum, f) => sum + f.contribution, 0)
    ));

    results.push({
      empKey: emp.EmpKey,
      name: `${emp.first_name} ${emp.last_name}`,
      department: emp.department,
      division: emp.division,
      supervisor: emp.supervisor || 'Unassigned',
      shift: emp.shift,
      riskScore: Math.round(riskScore * 10) / 10,
      riskLevel: scoreToLevel(riskScore),
      factors,
      overdueCount: overdue,
      completionRate,
      avgQuizScore,
      missingTopicCount,
      daysSinceLogin,
    });
  }

  // Sort highest risk first
  results.sort((a, b) => b.riskScore - a.riskScore);
  return results;
}

function makeFactor(name: string, weight: number, rawValue: number): RiskFactor {
  return { name, weight, rawValue, contribution: weight * rawValue };
}

function scoreToLevel(score: number): EmployeeRisk['riskLevel'] {
  if (score >= 76) return 'critical';
  if (score >= 51) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}
