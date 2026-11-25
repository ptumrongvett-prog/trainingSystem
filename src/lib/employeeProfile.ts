/**
 * Join FN-112 part training, topic assignments, and QC history
 * into one employee profile and the QC overview list.
 */

import type { Assignment, Employee } from '../types';
import { ComplianceStatus } from '../types';
import type { EmployeePartSummary, PartTrainingPair } from './partTraining';
import { normalizeEmployeeId, toIsoDate } from './partTraining';
import type { QcEmployeeHistory, QcIncident } from './qcContract';
import { hasRepeatPattern } from './qcContract';
import { resolveAssignmentStatus } from './statusRules';
import {
  classifyIncidents,
  countLinks,
  type IncidentRef,
  type PartTrainingRef,
  type TrainingLink,
  type TrainingLinkResult,
} from './trainingEffectiveness';

export interface ProfileTopic {
  assignmentId: string;
  topicId: string;
  topicName: string;
  status: ComplianceStatus;
  dateAssigned: string;
  dueDate: string;
}

export interface ProfileIncident {
  incident: QcIncident;
  link: TrainingLinkResult;
}

export interface EmployeeProfileModel {
  empId: string;
  employeeName: string;
  active: boolean;
  department: string;
  division: string;
  shift: string;
  supervisor: string;
  directoryFound: boolean;
  parts: PartTrainingPair[];
  topics: ProfileTopic[];
  qc: QcEmployeeHistory | null;
  incidents: ProfileIncident[];
  linkCounts: Record<TrainingLink, number>;
}

export interface OverviewEmployee {
  empId: string;
  employeeName: string;
  active: boolean;
  incidentCount: number;
  openCount: number;
  resolvedCount: number;
  repeat: boolean;
  latestIncidentAt: Date | null;
  /** Null while FN-112 is still loading, so the list does not claim "not trained". */
  linkCounts: Record<TrainingLink, number> | null;
  hasQc: boolean;
}

export type OverviewSort = 'incidents' | 'repeat';

const STATUS_RANK: Record<ComplianceStatus, number> = {
  [ComplianceStatus.OVERDUE]: 0,
  [ComplianceStatus.PENDING]: 1,
  [ComplianceStatus.NOT_SENT]: 2,
  [ComplianceStatus.SICK_LEAVE]: 3,
  [ComplianceStatus.NOT_ASSIGNED]: 4,
  [ComplianceStatus.COMPLETED]: 5,
  [ComplianceStatus.EXEMPT]: 6,
  [ComplianceStatus.INACTIVE]: 7,
};

export function matchesEmployeeQuery(empId: string, employeeName: string, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if (empId.toLowerCase().includes(text)) return true;
  if (employeeName.toLowerCase().includes(text)) return true;
  const asId = normalizeEmployeeId(query);
  return asId != null && empId === asId;
}

export function findDirectoryEmployees(empId: string, employees: readonly Employee[]): Employee[] {
  const id = normalizeEmployeeId(empId);
  if (!id) return [];
  return employees.filter(employee =>
    normalizeEmployeeId(employee.employee_number) === id
    || normalizeEmployeeId(employee.EmpKey) === id,
  );
}

export function isShownAssignment(assignment: Assignment): boolean {
  const flag = assignment.IsActive;
  if (flag === undefined || flag === null || flag === '') return true;
  if (typeof flag === 'boolean') return flag;
  const text = String(flag).trim().toLowerCase();
  return text !== 'false' && text !== '0' && text !== 'no';
}

function personName(employee: Employee | null): string {
  if (!employee) return '';
  return `${employee.first_name} ${employee.last_name}`.replace(/\s+/g, ' ').trim();
}

function toIncidentRef(incident: QcIncident): IncidentRef {
  return {
    incidentCode: incident.incidentCode,
    partNumber: incident.partNumber,
    incidentDate: incident.createdAt ? toIsoDate(incident.createdAt) : null,
  };
}

function toTrainingRef(part: PartTrainingPair): PartTrainingRef {
  return { partNumber: part.partNumber, firstDate: part.firstDate };
}

export function assembleEmployeeProfile(input: {
  empId: string;
  partEmployee: EmployeePartSummary | null;
  directory: readonly Employee[];
  assignments: readonly Assignment[];
  topicName: (topicId: string) => string;
  qc: QcEmployeeHistory | null;
  today?: Date;
}): EmployeeProfileModel {
  const empId = normalizeEmployeeId(input.empId) ?? input.empId.trim();
  const matches = findDirectoryEmployees(empId, input.directory);
  const directoryEmployee = matches.find(employee => normalizeEmployeeId(employee.employee_number) === empId) ?? matches[0] ?? null;
  const keys = new Set(matches.map(employee => employee.EmpKey));
  const today = input.today ?? new Date();

  const topics = input.assignments
    .filter(assignment => keys.has(assignment.EmpKey) && isShownAssignment(assignment))
    .map(assignment => ({
      assignmentId: assignment.AssignmentID,
      topicId: assignment.TopicID,
      topicName: input.topicName(assignment.TopicID) || assignment.TopicID,
      status: resolveAssignmentStatus(assignment, directoryEmployee, today),
      dateAssigned: assignment.DateAssigned || '',
      dueDate: assignment.DueDate || '',
    }))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.topicName.localeCompare(b.topicName));

  const parts = input.partEmployee?.parts ?? [];
  const training = parts.map(toTrainingRef);
  const links = classifyIncidents((input.qc?.incidents ?? []).map(toIncidentRef), training);
  const classified = (input.qc?.incidents ?? []).map((incident, index) => ({
    incident,
    link: links[index],
  }));

  const employeeName = input.partEmployee?.employeeName
    || personName(directoryEmployee)
    || input.qc?.employeeName
    || '';

  let active = false;
  if (input.partEmployee) active = input.partEmployee.active;
  else if (directoryEmployee) {
    const perm = (directoryEmployee.perm_temp || '').trim().toUpperCase();
    active = perm !== 'INACTIVE' && perm !== 'TERMINATED';
  }

  return {
    empId,
    employeeName,
    active,
    department: directoryEmployee?.department || '',
    division: directoryEmployee?.division || '',
    shift: directoryEmployee?.shift || '',
    supervisor: directoryEmployee?.supervisor || '',
    directoryFound: directoryEmployee != null,
    parts,
    topics,
    qc: input.qc,
    incidents: classified,
    linkCounts: countLinks(classified.map(item => item.link)),
  };
}

export function buildOverviewRows(input: {
  qcEmployees: readonly QcEmployeeHistory[];
  partEmployees: readonly EmployeePartSummary[];
  directory: readonly Employee[];
  assignments: readonly Assignment[];
  topicName: (topicId: string) => string;
  trainingLoaded: boolean;
  today?: Date;
}): OverviewEmployee[] {
  const qcById = new Map<string, QcEmployeeHistory>();
  for (const employee of input.qcEmployees) qcById.set(employee.employeeId, employee);

  const partById = new Map<string, EmployeePartSummary>();
  for (const employee of input.partEmployees) partById.set(employee.empId, employee);

  const ids = new Set<string>([
    ...qcById.keys(),
    ...partById.keys(),
    ...input.directory
      .map(employee => normalizeEmployeeId(employee.employee_number))
      .filter((id): id is string => id != null),
  ]);

  const rows: OverviewEmployee[] = [];
  for (const empId of ids) {
    const qc = qcById.get(empId) ?? null;
    const profile = assembleEmployeeProfile({
      empId,
      partEmployee: partById.get(empId) ?? null,
      directory: input.directory,
      assignments: input.assignments,
      topicName: input.topicName,
      qc: input.trainingLoaded ? qc : null,
      today: input.today,
    });
    rows.push({
      empId: profile.empId,
      employeeName: profile.employeeName || qc?.employeeName || '',
      active: profile.active,
      incidentCount: qc?.incidentCount ?? 0,
      openCount: qc?.openCount ?? 0,
      resolvedCount: qc?.resolvedCount ?? 0,
      repeat: qc ? hasRepeatPattern(qc.repeatedPatterns) : false,
      latestIncidentAt: qc?.latestIncidentAt ?? null,
      linkCounts: input.trainingLoaded && qc ? profile.linkCounts : null,
      hasQc: qc != null,
    });
  }
  return rows;
}

export function sortOverview(rows: readonly OverviewEmployee[], sort: OverviewSort): OverviewEmployee[] {
  return [...rows].sort((a, b) => {
    if (sort === 'repeat' && a.repeat !== b.repeat) return a.repeat ? -1 : 1;
    if (b.incidentCount !== a.incidentCount) return b.incidentCount - a.incidentCount;
    const byName = a.employeeName.localeCompare(b.employeeName);
    if (byName !== 0) return byName;
    return a.empId.localeCompare(b.empId, undefined, { numeric: true });
  });
}

export function filterOverview(
  rows: readonly OverviewEmployee[],
  query: string,
  qcOnly: boolean,
): OverviewEmployee[] {
  return rows.filter(row => {
    if (!matchesEmployeeQuery(row.empId, row.employeeName, query)) return false;
    if (qcOnly && !row.hasQc) return false;
    return true;
  });
}
