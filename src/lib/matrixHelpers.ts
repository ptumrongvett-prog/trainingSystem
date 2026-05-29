/**
 * matrixHelpers.ts — Training matrix computation helpers.
 * Pure functions for building the employee-topic matrix.
 */

import type { Employee, Assignment } from '../types';
import { ComplianceStatus } from '../types';
import { resolveAssignmentStatus } from './statusRules';
import { discoverTopics } from './topicMap';

export interface MatrixRow {
  empKey: string;
  name: string;
  department: string;
  division: string;
  shift: string;
  cells: Map<string, ComplianceStatus>;
}

/**
 * Build the employee-topic matrix.
 * Returns rows (employees) with status per topic column.
 */
export function buildMatrix(
  employees: Employee[],
  assignments: Assignment[],
): { rows: MatrixRow[]; topicIds: string[] } {
  const topicIds = discoverTopics(assignments);

  // Group assignments by EmpKey+TopicID
  const assignMap = new Map<string, Assignment>();
  for (const a of assignments) {
    const key = `${a.EmpKey}|${a.TopicID}`;
    // Keep the most recent (or completed) assignment
    const existing = assignMap.get(key);
    if (!existing || (a.Status || '').toLowerCase() === 'completed') {
      assignMap.set(key, a);
    }
  }

  const rows: MatrixRow[] = employees.map(emp => {
    const cells = new Map<string, ComplianceStatus>();
    for (const topic of topicIds) {
      const key = `${emp.EmpKey}|${topic}`;
      const assignment = assignMap.get(key) || null;
      cells.set(topic, resolveAssignmentStatus(assignment, emp));
    }
    return {
      empKey: emp.EmpKey,
      name: `${emp.first_name} ${emp.last_name}`,
      department: emp.department,
      division: emp.division,
      shift: emp.shift,
      cells,
    };
  });

  return { rows, topicIds };
}

/** Convert matrix to flat export-ready array */
export function matrixToExportData(rows: MatrixRow[], topicIds: string[]): Record<string, string>[] {
  return rows.map(r => {
    const obj: Record<string, string> = {
      Name: r.name,
      EmpKey: r.empKey,
      Department: r.department,
      Division: r.division,
      Shift: r.shift,
    };
    for (const t of topicIds) {
      obj[t] = r.cells.get(t) || 'Not Assigned';
    }
    return obj;
  });
}
