/**
 * supervisorHelpers.ts — Supervisor follow-up computation.
 * Pure functions for supervisor drill-down.
 */

import type { Employee, Assignment } from '../types';
import { isOverdue } from './statusRules';
import { parseAppSheetDate } from './dateUtils';

export interface SupervisorRow {
  supervisor: string;
  employeeCount: number;
  missingCount: number;
  overdueCount: number;
  dueSoon7: number;
  completionRate: number;
  employees: SupervisorEmployee[];
}

export interface SupervisorEmployee {
  empKey: string;
  name: string;
  department: string;
  division: string;
  shift: string;
  totalAssigned: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  nextDue: string;
  status: 'ok' | 'warning' | 'critical';
}

/**
 * Build supervisor follow-up data.
 */
export function buildSupervisorFollowUp(
  employees: Employee[],
  assignments: Assignment[],
): SupervisorRow[] {
  const today = new Date();
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() + 7);

  const activeAssigns = assignments.filter(a =>
    a.IsActive === true || a.IsActive === 'TRUE' || a.IsActive === 'true'
  );

  // Group employees by supervisor
  const supGroups = new Map<string, Employee[]>();
  for (const e of employees) {
    const sup = e.supervisor || 'Unassigned';
    const list = supGroups.get(sup) || [];
    list.push(e);
    supGroups.set(sup, list);
  }

  // Group assignments by EmpKey
  const empAssigns = new Map<string, Assignment[]>();
  for (const a of activeAssigns) {
    const list = empAssigns.get(a.EmpKey) || [];
    list.push(a);
    empAssigns.set(a.EmpKey, list);
  }

  const rows: SupervisorRow[] = [];

  for (const [supervisor, emps] of supGroups) {
    let totalMissing = 0;
    let totalOverdue = 0;
    let totalDueSoon = 0;
    let totalCompleted = 0;
    let totalAssigned = 0;
    const supEmployees: SupervisorEmployee[] = [];

    for (const emp of emps) {
      const assigns = empAssigns.get(emp.EmpKey) || [];
      const completed = assigns.filter(a => norm(a.Status) === 'completed').length;
      const overdue = assigns.filter(a => isOverdue(a, today)).length;
      const dueSoon = assigns.filter(a => {
        if (norm(a.Status) === 'completed') return false;
        const due = parseAppSheetDate(a.DueDate);
        return due !== null && due >= today && due <= sevenDays;
      }).length;

      // Next due date
      const pendingDates = assigns
        .filter(a => norm(a.Status) !== 'completed' && a.DueDate)
        .map(a => ({ date: parseAppSheetDate(a.DueDate), raw: a.DueDate }))
        .filter(d => d.date !== null)
        .sort((a, b) => a.date!.getTime() - b.date!.getTime());
      const nextDue = pendingDates.length > 0 ? pendingDates[0].raw : '—';

      const missing = assigns.length === 0 ? 1 : 0;
      totalMissing += missing;
      totalOverdue += overdue;
      totalDueSoon += dueSoon;
      totalCompleted += completed;
      totalAssigned += assigns.length;

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (overdue > 0) status = 'critical';
      else if (dueSoon > 0) status = 'warning';

      supEmployees.push({
        empKey: emp.EmpKey,
        name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department,
        division: emp.division,
        shift: emp.shift,
        totalAssigned: assigns.length,
        completed,
        overdue,
        dueSoon,
        nextDue,
        status,
      });
    }

    // Sort employees: critical first, then warning, then ok
    supEmployees.sort((a, b) => {
      const order = { critical: 0, warning: 1, ok: 2 };
      return order[a.status] - order[b.status] || a.name.localeCompare(b.name);
    });

    rows.push({
      supervisor,
      employeeCount: emps.length,
      missingCount: totalMissing,
      overdueCount: totalOverdue,
      dueSoon7: totalDueSoon,
      completionRate: totalAssigned > 0 ? totalCompleted / totalAssigned : 0,
      employees: supEmployees,
    });
  }

  // Sort: most overdue first
  rows.sort((a, b) => b.overdueCount - a.overdueCount || b.dueSoon7 - a.dueSoon7);
  return rows;
}

function norm(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}
