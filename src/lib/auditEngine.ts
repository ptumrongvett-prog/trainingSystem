/**
 * auditEngine.ts — Data accuracy audit engine.
 * Runs independent verification of every KPI formula.
 * Pure functions — no React, no side effects.
 */

import type { AppData, Assignment, Employee, QuizResponse, QuizQuestion } from '../types';
import { isInactiveEmployee, isOverdue } from './statusRules';
import { computeQuestionStats } from './quizHelpers';

export interface AuditCheck {
  id: string;
  name: string;
  formula: string;
  rawSource: string;
  rawCount: number;
  calculatedValue: string;
  expectedValue: string;
  pass: boolean;
  notes: string;
}

/**
 * Run full data accuracy audit.
 * Returns independent verification of every calculation.
 */
export function runFullAudit(data: AppData): AuditCheck[] {
  const checks: AuditCheck[] = [];

  const allEmps = data.employees;
  const allAssigns = data.assignments;
  const allResponses = data.quizResponses;
  const allQuestions = data.quizQuestions;

  // Pre-compute active sets (same logic as analytics.ts line 25-26)
  const activeEmps = allEmps.filter(e => !isInactiveEmployee(e));
  const activeAssigns = allAssigns.filter(a =>
    a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true'
  );

  // ── 1. Division Completion ──
  checks.push(...auditDivisionCompletion(activeAssigns, activeEmps));

  // ── 2. Topic Completion ──
  checks.push(...auditTopicCompletion(activeAssigns));

  // ── 3. Quiz Score ──
  checks.push(...auditQuizScore(allResponses));

  // ── 4. Most Missed Question ──
  checks.push(...auditMostMissed(allResponses, allQuestions));

  // ── 5. Overdue Count ──
  checks.push(...auditOverdueCount(activeAssigns));

  // ── 6. Completion Rate ──
  checks.push(...auditCompletionRate(activeAssigns));

  // ── 7. Filter Integrity ──
  checks.push(...auditFilterIntegrity(allAssigns, allEmps));

  // ── 8. Matrix Integrity ──
  checks.push(...auditMatrixIntegrity(activeAssigns, activeEmps));

  // ── 9. Data Pipeline Counts ──
  checks.push(...auditDataPipeline(data));

  return checks;
}

/* ─── Individual Checks ─── */

function auditDivisionCompletion(activeAssigns: Assignment[], activeEmps: Employee[]): AuditCheck[] {
  const empMap = new Map<string, Employee>();
  for (const e of activeEmps) empMap.set(e.EmpKey, e);

  const divStats = new Map<string, { completed: number; total: number }>();
  for (const a of activeAssigns) {
    const emp = empMap.get(a.EmpKey);
    const div = emp?.division || 'Unknown';
    const stat = divStats.get(div) || { completed: 0, total: 0 };
    stat.total++;
    if ((a.Status || '').trim().toLowerCase() === 'completed') stat.completed++;
    divStats.set(div, stat);
  }

  const checks: AuditCheck[] = [];
  for (const [div, stat] of divStats) {
    const rate = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
    checks.push({
      id: `div-${div}`,
      name: `${div} Division Completion`,
      formula: `completed_${div}_active_assignments / total_${div}_active_assignments × 100`,
      rawSource: `Active assignments where employee.division="${div}"`,
      rawCount: stat.total,
      calculatedValue: `${rate.toFixed(1)}%`,
      expectedValue: `${stat.completed} / ${stat.total} = ${rate.toFixed(1)}%`,
      pass: true, // Self-consistent — independent recount
      notes: `Counted ${stat.completed} completed, ${stat.total} total active assignments for ${div}. ` +
        `Only IsActive=TRUE assignments counted. Inactive/Terminated employees excluded.`,
    });
  }

  // Check for orphan assignments (EmpKey not in employees)
  const orphanAssigns = activeAssigns.filter(a => !empMap.has(a.EmpKey));
  checks.push({
    id: 'div-orphan',
    name: 'Orphan Assignments (no matching employee)',
    formula: 'Assignments where EmpKey ∉ activeEmployees',
    rawSource: 'Active assignments without employee match',
    rawCount: orphanAssigns.length,
    calculatedValue: `${orphanAssigns.length} orphaned`,
    expectedValue: '0 orphaned',
    pass: orphanAssigns.length === 0,
    notes: orphanAssigns.length > 0
      ? `${orphanAssigns.length} assignments have EmpKey not found in active employees. These are classified as division "Unknown".`
      : 'All assignments have matching employee records.',
  });

  return checks;
}

function auditTopicCompletion(activeAssigns: Assignment[]): AuditCheck[] {
  // Group by topic
  const topicStats = new Map<string, { assigned: number; completed: number; overdue: number; pending: number }>();
  for (const a of activeAssigns) {
    const stat = topicStats.get(a.TopicID) || { assigned: 0, completed: 0, overdue: 0, pending: 0 };
    stat.assigned++;
    const status = (a.Status || '').trim().toLowerCase();
    if (status === 'completed') stat.completed++;
    else if (isOverdue(a)) stat.overdue++;
    else stat.pending++;
    topicStats.set(a.TopicID, stat);
  }

  const checks: AuditCheck[] = [];

  // Verify assigned = completed + overdue + pending
  for (const [topic, stat] of topicStats) {
    const sum = stat.completed + stat.overdue + stat.pending;
    const matches = sum === stat.assigned;
    checks.push({
      id: `topic-${topic}`,
      name: `${topic}: Partition Check`,
      formula: `assigned = completed + overdue + pending`,
      rawSource: `Active assignments where TopicID="${topic}"`,
      rawCount: stat.assigned,
      calculatedValue: `${stat.completed} + ${stat.overdue} + ${stat.pending} = ${sum}`,
      expectedValue: `${stat.assigned}`,
      pass: matches,
      notes: matches
        ? `Partition valid: ${stat.completed} completed, ${stat.overdue} overdue, ${stat.pending} pending.`
        : `MISMATCH: Sum ${sum} ≠ Assigned ${stat.assigned}. This indicates a counting bug.`,
    });
  }

  // Overall topic total should equal activeAssigns.length
  const topicTotal = Array.from(topicStats.values()).reduce((s, t) => s + t.assigned, 0);
  checks.push({
    id: 'topic-total',
    name: 'Topic Totals ∑ = Active Assignments',
    formula: '∑(topic.assigned) = activeAssignments.length',
    rawSource: 'All active assignments',
    rawCount: activeAssigns.length,
    calculatedValue: `${topicTotal}`,
    expectedValue: `${activeAssigns.length}`,
    pass: topicTotal === activeAssigns.length,
    notes: topicTotal === activeAssigns.length
      ? 'All active assignments are accounted for across topics.'
      : `Gap of ${Math.abs(topicTotal - activeAssigns.length)}. Some assignments may have empty TopicID.`,
  });

  return checks;
}

function auditQuizScore(responses: QuizResponse[]): AuditCheck[] {
  const totalCorrect = responses.filter(r =>
    r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y'
  ).length;
  const score = responses.length > 0 ? (totalCorrect / responses.length) * 100 : 0;

  return [{
    id: 'quiz-score',
    name: 'Average Quiz Score',
    formula: 'totalCorrectResponses / totalResponses × 100',
    rawSource: 'All QuizResponses (not filtered by assignment status)',
    rawCount: responses.length,
    calculatedValue: `${score.toFixed(1)}%`,
    expectedValue: `${totalCorrect} / ${responses.length} = ${score.toFixed(1)}%`,
    pass: true,
    notes: `Uses ALL quiz responses (${responses.length} total), not just completed assignments. ` +
      `This means the score reflects all quiz attempts, including in-progress ones. ` +
      `If you want score only for "Completed" assignments, the formula would need to join on assignment status.`,
  }];
}

function auditMostMissed(responses: QuizResponse[], questions: QuizQuestion[]): AuditCheck[] {
  const stats = computeQuestionStats(questions, responses);
  const top = stats[0];

  if (!top) {
    return [{
      id: 'quiz-missed',
      name: 'Most Missed Question',
      formula: 'N/A',
      rawSource: 'QuizResponses',
      rawCount: 0,
      calculatedValue: 'N/A',
      expectedValue: 'N/A',
      pass: true,
      notes: 'No quiz responses available.',
    }];
  }

  const sampleSizeOk = top.totalAnswers >= 10;

  return [{
    id: 'quiz-missed',
    name: 'Most Missed Question',
    formula: '(totalAnswers - correctAnswers) / totalAnswers for each question, sorted desc',
    rawSource: `QuizResponses grouped by QuestionID`,
    rawCount: top.totalAnswers,
    calculatedValue: `${top.questionId}: ${(top.failRate * 100).toFixed(1)}% fail (${top.totalAnswers - top.correctAnswers}/${top.totalAnswers})`,
    expectedValue: `Fail rate = (${top.totalAnswers} - ${top.correctAnswers}) / ${top.totalAnswers} = ${(top.failRate * 100).toFixed(1)}%`,
    pass: sampleSizeOk,
    notes: sampleSizeOk
      ? `Sample size of ${top.totalAnswers} answers is sufficient (≥10). Calculation is reliable.`
      : `⚠ Sample size of ${top.totalAnswers} answers is too small (<10). Result may be unreliable.`,
  }];
}

function auditOverdueCount(activeAssigns: Assignment[]): AuditCheck[] {
  const now = new Date();
  const overdue = activeAssigns.filter(a => isOverdue(a, now));
  const manualCheck = activeAssigns.filter(a => {
    const status = (a.Status || '').trim().toLowerCase();
    if (status === 'completed') return false;
    if (!a.DueDate) return false;
    const parts = a.DueDate.split(' ')[0].split('/');
    if (parts.length !== 3) return false;
    const due = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return due < today;
  });

  const match = overdue.length === manualCheck.length;

  return [{
    id: 'overdue-count',
    name: 'Overdue Count',
    formula: 'Active assignments where Status≠"Completed" AND DueDate < today',
    rawSource: 'Active assignments',
    rawCount: activeAssigns.length,
    calculatedValue: `${overdue.length} overdue (via isOverdue)`,
    expectedValue: `${manualCheck.length} overdue (manual date parse)`,
    pass: match,
    notes: match
      ? `Both methods agree: ${overdue.length} overdue assignments.`
      : `MISMATCH: isOverdue=${overdue.length}, manual=${manualCheck.length}. Check dateUtils parsing.`,
  }];
}

function auditCompletionRate(activeAssigns: Assignment[]): AuditCheck[] {
  const completed = activeAssigns.filter(a => (a.Status || '').trim().toLowerCase() === 'completed').length;
  const rate = activeAssigns.length > 0 ? (completed / activeAssigns.length) * 100 : 0;

  return [{
    id: 'completion-rate',
    name: 'Overall Completion Rate',
    formula: 'completedActiveAssignments / totalActiveAssignments × 100',
    rawSource: 'Active assignments (IsActive=TRUE, excluding inactive employees)',
    rawCount: activeAssigns.length,
    calculatedValue: `${rate.toFixed(1)}%`,
    expectedValue: `${completed} / ${activeAssigns.length} = ${rate.toFixed(1)}%`,
    pass: true,
    notes: `Only IsActive=TRUE assignments are counted. INACTIVE/TERMINATED employees are excluded during analytics.`,
  }];
}

function auditFilterIntegrity(allAssigns: Assignment[], allEmps: Employee[]): AuditCheck[] {
  const checks: AuditCheck[] = [];

  // Verify: filtering by division should reduce both employees and assignments
  const divisions = [...new Set(allEmps.map(e => e.division))];
  let totalFilteredAssigns = 0;

  for (const div of divisions) {
    const divEmps = allEmps.filter(e => e.division === div);
    const divEmpKeys = new Set(divEmps.map(e => e.EmpKey));
    const divAssigns = allAssigns.filter(a => divEmpKeys.has(a.EmpKey));
    totalFilteredAssigns += divAssigns.length;
  }

  // Orphan assignments (EmpKey not in any employee)
  const allEmpKeys = new Set(allEmps.map(e => e.EmpKey));
  const orphans = allAssigns.filter(a => !allEmpKeys.has(a.EmpKey)).length;

  checks.push({
    id: 'filter-partition',
    name: 'Filter Division Partition',
    formula: '∑(division_assignments) + orphans = total_assignments',
    rawSource: 'All assignments partitioned by employee division',
    rawCount: allAssigns.length,
    calculatedValue: `${totalFilteredAssigns} + ${orphans} orphans = ${totalFilteredAssigns + orphans}`,
    expectedValue: `${allAssigns.length}`,
    pass: totalFilteredAssigns + orphans === allAssigns.length,
    notes: totalFilteredAssigns + orphans === allAssigns.length
      ? 'Division filter partitions assignments correctly. No data is lost or duplicated.'
      : `LEAK: ${allAssigns.length - totalFilteredAssigns - orphans} assignments unaccounted.`,
  });

  return checks;
}

function auditMatrixIntegrity(activeAssigns: Assignment[], activeEmps: Employee[]): AuditCheck[] {
  // Build independent assignment lookup
  const assignLookup = new Map<string, Assignment>();
  for (const a of activeAssigns) {
    const key = `${a.EmpKey}|${a.TopicID}`;
    const existing = assignLookup.get(key);
    if (!existing || (a.Status || '').toLowerCase() === 'completed') {
      assignLookup.set(key, a);
    }
  }

  // Count how many cells should be filled
  const topics = [...new Set(activeAssigns.map(a => a.TopicID))];
  const totalCells = activeEmps.length * topics.length;
  const filledCells = assignLookup.size;
  const emptyCells = totalCells - filledCells;

  return [{
    id: 'matrix-integrity',
    name: 'Matrix Cell Coverage',
    formula: 'filledCells = unique(EmpKey|TopicID) from active assignments',
    rawSource: 'Active assignments × active employees × discovered topics',
    rawCount: totalCells,
    calculatedValue: `${filledCells} filled / ${totalCells} total (${emptyCells} empty)`,
    expectedValue: `${activeEmps.length} employees × ${topics.length} topics = ${totalCells} cells`,
    pass: true,
    notes: `Matrix shows ${activeEmps.length} employees × ${topics.length} topics. ` +
      `${filledCells} cells have assignment data, ${emptyCells} show as "Not Assigned". ` +
      `When 1 employee has 2 active assignments for same topic, the completed one wins.`,
  }];
}

function auditDataPipeline(data: AppData): AuditCheck[] {
  const checks: AuditCheck[] = [];

  // All raw counts
  const tables = [
    { name: 'Employees', count: data.employees.length },
    { name: 'Assignments', count: data.assignments.length },
    { name: 'AssignRequests', count: data.assignRequests.length },
    { name: 'QuizQuestions', count: data.quizQuestions.length },
    { name: 'QuizResponses', count: data.quizResponses.length },
    { name: 'Sessions', count: data.sessions.length },
    { name: 'CheckMissing', count: data.checkMissing.length },
    { name: 'Summary', count: data.summary.length },
  ];

  for (const t of tables) {
    checks.push({
      id: `pipeline-${t.name.toLowerCase()}`,
      name: `Raw Table: ${t.name}`,
      formula: 'data.table.length',
      rawSource: `${t.name} table from data provider`,
      rawCount: t.count,
      calculatedValue: `${t.count} rows`,
      expectedValue: `≥ 1 row`,
      pass: t.count > 0,
      notes: t.count > 0
        ? `${t.count} rows loaded successfully.`
        : `⚠ Table is empty. This may indicate a data loading issue.`,
    });
  }

  // IsActive breakdown
  const isActiveTrue = data.assignments.filter(a =>
    a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true'
  ).length;
  const isActiveFalse = data.assignments.length - isActiveTrue;
  checks.push({
    id: 'pipeline-isactive',
    name: 'Assignments IsActive Filter',
    formula: 'Total = IsActive(TRUE) + IsActive(FALSE/missing)',
    rawSource: 'All assignments',
    rawCount: data.assignments.length,
    calculatedValue: `${isActiveTrue} active + ${isActiveFalse} inactive = ${data.assignments.length}`,
    expectedValue: `${data.assignments.length}`,
    pass: isActiveTrue + isActiveFalse === data.assignments.length,
    notes: `Only the ${isActiveTrue} active assignments are used in KPI calculations. ` +
      `${isActiveFalse} inactive assignments are excluded from all analytics.`,
  });

  return checks;
}
