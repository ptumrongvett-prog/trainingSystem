/**
 * auditLogHelpers.ts — Compliance history log builder.
 * Reconstructs a timeline from assignments, quiz responses, and sessions.
 * Pure functions.
 */

import type { Employee, Assignment, QuizResponse, Session } from '../types';
import { parseAppSheetDate } from './dateUtils';

export interface AuditLogEntry {
  dateTime: Date | null;
  dateTimeStr: string;
  empKey: string;
  employeeName: string;
  supervisor: string;
  topic: string;
  action: string;
  source: string;
  score: string;
  details: string;
}

/**
 * Build audit log from all available data sources.
 */
export function buildAuditLog(
  employees: Employee[],
  assignments: Assignment[],
  quizResponses: QuizResponse[],
  sessions: Session[],
): AuditLogEntry[] {
  const empMap = new Map<string, Employee>();
  for (const e of employees) empMap.set(e.EmpKey, e);

  const entries: AuditLogEntry[] = [];

  // Assignment events
  for (const a of assignments) {
    const emp = empMap.get(a.EmpKey);
    const name = emp ? `${emp.first_name} ${emp.last_name}` : a.EmpKey;
    const supervisor = emp?.supervisor || '—';

    // Assignment created
    if (a.DateAssigned) {
      entries.push({
        dateTime: parseAppSheetDate(a.DateAssigned),
        dateTimeStr: a.DateAssigned,
        empKey: a.EmpKey,
        employeeName: name,
        supervisor,
        topic: a.TopicID,
        action: 'Training Assigned',
        source: 'Assignment',
        score: '—',
        details: `Assignment ${a.AssignmentID} created. Due: ${a.DueDate || 'No due date'}`,
      });
    }

    // Completed
    if ((a.Status || '').toLowerCase() === 'completed') {
      entries.push({
        dateTime: parseAppSheetDate(a.DueDate) || parseAppSheetDate(a.DateAssigned),
        dateTimeStr: a.DueDate || a.DateAssigned || '—',
        empKey: a.EmpKey,
        employeeName: name,
        supervisor,
        topic: a.TopicID,
        action: 'Training Completed',
        source: 'Assignment',
        score: '—',
        details: `Assignment ${a.AssignmentID} completed.`,
      });
    }
  }

  // Quiz events
  for (const r of quizResponses) {
    const emp = empMap.get(r.EmpKey);
    const name = emp ? `${emp.first_name} ${emp.last_name}` : r.EmpKey;
    const supervisor = emp?.supervisor || '—';
    const isCorrect = r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y';

    entries.push({
      dateTime: parseAppSheetDate(r.DateTime),
      dateTimeStr: r.DateTime || '—',
      empKey: r.EmpKey,
      employeeName: name,
      supervisor,
      topic: r.QuestionID,
      action: 'Quiz Answer',
      source: 'Quiz',
      score: isCorrect ? 'Correct' : 'Incorrect',
      details: `Q: ${r.QuestionID} — Selected: ${r.SelectedAnswer}`,
    });
  }

  // Session events
  for (const s of sessions) {
    const emp = empMap.get(s.LoggedInEmpKey);
    const name = emp ? `${emp.first_name} ${emp.last_name}` : s.LoggedInEmpKey;
    const supervisor = emp?.supervisor || '—';

    entries.push({
      dateTime: parseAppSheetDate(s.LoggedInAt),
      dateTimeStr: s.LoggedInAt || '—',
      empKey: s.LoggedInEmpKey,
      employeeName: name,
      supervisor,
      topic: '—',
      action: 'Session Login',
      source: 'Session',
      score: '—',
      details: `Session ${s.SessionID}. Device: ${s.DeviceID || '—'}`,
    });
  }

  // Sort newest first
  entries.sort((a, b) => {
    const ta = a.dateTime?.getTime() ?? 0;
    const tb = b.dateTime?.getTime() ?? 0;
    return tb - ta;
  });

  return entries;
}
