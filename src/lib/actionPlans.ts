/**
 * actionPlans.ts — Supervisor action plan builder.
 * Converts overdue/due-soon/missing data into prioritized to-do items.
 * Reuses buildSupervisorFollowUp(). Additive only (Phase 5).
 */

import type { Employee, Assignment, QuizResponse } from '../types';
import { buildSupervisorFollowUp } from './supervisorHelpers';
import { isOverdue } from './statusRules';
import { parseAppSheetDate } from './dateUtils';

export interface ActionItem {
  id: string;
  type: 'follow_up_overdue' | 'send_reminder' | 'review_quiz' | 'assign_missing';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  employeeName: string;
  empKey: string;
  topic: string;
  description: string;
  daysPastDue: number;
  estimatedMinutes: number;
}

export interface ActionPlan {
  supervisor: string;
  generatedAt: Date;
  totalActions: number;
  urgentCount: number;
  estimatedMinutes: number;
  actions: ActionItem[];
}

const TIME_EST: Record<ActionItem['type'], number> = {
  follow_up_overdue: 10,
  send_reminder: 5,
  review_quiz: 15,
  assign_missing: 5,
};

const PRIORITY_ORDER: Record<ActionItem['priority'], number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

/**
 * Build action plans for all supervisors.
 */
export function buildActionPlans(
  employees: Employee[],
  assignments: Assignment[],
  quizResponses: QuizResponse[],
): ActionPlan[] {
  const today = new Date();
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() + 7);

  // Reuse existing supervisor follow-up data
  const supRows = buildSupervisorFollowUp(employees, assignments);

  // Pre-group quiz scores by EmpKey
  const empQuiz = new Map<string, { correct: number; total: number }>();
  for (const r of quizResponses) {
    const stat = empQuiz.get(r.EmpKey) || { correct: 0, total: 0 };
    stat.total++;
    if (r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y') stat.correct++;
    empQuiz.set(r.EmpKey, stat);
  }

  // Pre-group active assignments by EmpKey
  const activeAssigns = assignments.filter(a =>
    a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true'
  );
  const empAssigns = new Map<string, Assignment[]>();
  for (const a of activeAssigns) {
    const list = empAssigns.get(a.EmpKey) || [];
    list.push(a);
    empAssigns.set(a.EmpKey, list);
  }

  let actionIdCounter = 0;
  const plans: ActionPlan[] = [];

  for (const supRow of supRows) {
    const actions: ActionItem[] = [];

    for (const emp of supRow.employees) {
      const assigns = empAssigns.get(emp.empKey) || [];

      // 1. Overdue follow-ups
      const overdueAssigns = assigns.filter(a => isOverdue(a, today));
      for (const a of overdueAssigns) {
        const due = parseAppSheetDate(a.DueDate);
        const daysPast = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;

        let priority: ActionItem['priority'] = 'medium';
        if (daysPast > 30) priority = 'urgent';
        else if (daysPast > 14) priority = 'high';

        actions.push({
          id: `act-${++actionIdCounter}`,
          type: 'follow_up_overdue',
          priority,
          employeeName: emp.name,
          empKey: emp.empKey,
          topic: a.TopicID,
          description: `Overdue ${daysPast} days. Due: ${a.DueDate}. Follow up immediately.`,
          daysPastDue: daysPast,
          estimatedMinutes: TIME_EST.follow_up_overdue,
        });
      }

      // 2. Due within 7 days — send reminder
      const dueSoonAssigns = assigns.filter(a => {
        if ((a.Status || '').toLowerCase() === 'completed') return false;
        if (isOverdue(a, today)) return false;
        const due = parseAppSheetDate(a.DueDate);
        return due !== null && due >= today && due <= sevenDays;
      });
      for (const a of dueSoonAssigns) {
        const due = parseAppSheetDate(a.DueDate);
        const daysLeft = due ? Math.floor((due.getTime() - today.getTime()) / 86400000) : 0;
        actions.push({
          id: `act-${++actionIdCounter}`,
          type: 'send_reminder',
          priority: 'medium',
          employeeName: emp.name,
          empKey: emp.empKey,
          topic: a.TopicID,
          description: `Due in ${daysLeft} days (${a.DueDate}). Send training reminder.`,
          daysPastDue: 0,
          estimatedMinutes: TIME_EST.send_reminder,
        });
      }

      // 3. Low quiz score — review
      const quiz = empQuiz.get(emp.empKey);
      if (quiz && quiz.total >= 5) {
        const score = quiz.correct / quiz.total;
        if (score < 0.7) {
          const priority: ActionItem['priority'] = score < 0.5 ? 'high' : 'low';
          actions.push({
            id: `act-${++actionIdCounter}`,
            type: 'review_quiz',
            priority,
            employeeName: emp.name,
            empKey: emp.empKey,
            topic: '—',
            description: `Quiz score: ${(score * 100).toFixed(0)}% (${quiz.correct}/${quiz.total}). May need retraining.`,
            daysPastDue: 0,
            estimatedMinutes: TIME_EST.review_quiz,
          });
        }
      }

      // 4. No assignments at all — assign missing
      if (assigns.length === 0) {
        actions.push({
          id: `act-${++actionIdCounter}`,
          type: 'assign_missing',
          priority: 'low',
          employeeName: emp.name,
          empKey: emp.empKey,
          topic: '—',
          description: 'No training assigned. Assign required topics.',
          daysPastDue: 0,
          estimatedMinutes: TIME_EST.assign_missing,
        });
      }
    }

    // Sort by priority
    actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.daysPastDue - a.daysPastDue);

    plans.push({
      supervisor: supRow.supervisor,
      generatedAt: today,
      totalActions: actions.length,
      urgentCount: actions.filter(a => a.priority === 'urgent').length,
      estimatedMinutes: actions.reduce((s, a) => s + a.estimatedMinutes, 0),
      actions,
    });
  }

  // Sort by urgent count descending
  plans.sort((a, b) => b.urgentCount - a.urgentCount || b.totalActions - a.totalActions);
  return plans;
}

/**
 * Generate a copy-pasteable email template for an action item.
 */
export function generateEmailTemplate(action: ActionItem, supervisor: string): string {
  const lines = [
    `Subject: Training Follow-Up Required — ${action.employeeName}`,
    ``,
    `Hi ${action.employeeName},`,
    ``,
  ];

  switch (action.type) {
    case 'follow_up_overdue':
      lines.push(`Your training for ${action.topic} is overdue by ${action.daysPastDue} days.`);
      lines.push(`Please complete it as soon as possible.`);
      break;
    case 'send_reminder':
      lines.push(`This is a reminder that your training for ${action.topic} is due soon.`);
      lines.push(`${action.description}`);
      break;
    case 'review_quiz':
      lines.push(`Your recent quiz performance needs improvement.`);
      lines.push(`${action.description}`);
      lines.push(`Please review the training material and retake the quiz.`);
      break;
    case 'assign_missing':
      lines.push(`You currently have no training assignments.`);
      lines.push(`Your supervisor will assign the required topics shortly.`);
      break;
  }

  lines.push(``, `Thank you,`, supervisor.split('@')[0]);
  return lines.join('\n');
}
