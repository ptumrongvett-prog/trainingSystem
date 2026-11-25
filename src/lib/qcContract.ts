/**
 * Read model for the QC history written by the plant PC script.
 * The browser only reads these documents. Missing fields are tolerated
 * so a partial sync still renders.
 *
 * qc_employee_history/{employeeId}
 * qc_meta/summary
 */

import { normalizeEmployeeId, toIsoDate } from './partTraining';

export type QcStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'UNKNOWN';

export interface QcCategoryCount {
  category: string;
  count: number;
}

export interface QcPartCount {
  partNumber: string;
  partDescription: string;
  count: number;
}

export interface QcRepeatPattern {
  partNumber: string;
  category: string;
  count: number;
}

export interface QcAction {
  text: string;
  by: string;
  at: Date | null;
}

export interface QcIncident {
  incidentCode: string;
  createdAt: Date | null;
  status: QcStatus;
  partNumber: string;
  partDescription: string;
  jobNumber: string;
  machine: string;
  shiftName: string;
  categories: string[];
  problem: string;
  latestAction: QcAction | null;
  actionCount: number;
  mediaCount: number;
  resolvedAt: Date | null;
}

export interface QcEmployeeHistory {
  employeeId: string;
  employeeName: string;
  incidentCount: number;
  openCount: number;
  resolvedCount: number;
  latestIncidentAt: Date | null;
  categories: QcCategoryCount[];
  parts: QcPartCount[];
  repeatedPatterns: QcRepeatPattern[];
  incidents: QcIncident[];
  syncedAt: Date | null;
}

export interface QcSummary {
  generatedAt: Date | null;
  syncedAt: Date | null;
  employeeCount: number;
  incidentCount: number;
  openCount: number;
  repeatEmployeeCount: number;
  categories: QcCategoryCount[];
  lastRunOk: boolean | null;
}

/** A QC repeat is a pattern the sync recorded more than once. */
export function hasRepeatPattern(patterns: readonly { count: number }[]): boolean {
  return patterns.some(pattern => pattern.count >= 2);
}

export function readQcDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (day) {
      const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    const record = value as { toDate?: () => Date; seconds?: unknown; _seconds?: unknown };
    if (typeof record.toDate === 'function') {
      try {
        const date = record.toDate();
        if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
      } catch {
        /* A broken Timestamp should not blank the rest of the document. */
      }
    }
    const seconds = typeof record.seconds === 'number' ? record.seconds : record._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const date = new Date(seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

export function calendarDay(date: Date | null): string | null {
  if (!date) return null;
  return toIsoDate(date);
}

/** Local date, plus a time when the value is not midnight. */
export function formatQcStamp(date: Date | null): string {
  if (!date) return '—';
  const day = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  const midnight = date.getHours() === 0 && date.getMinutes() === 0
    && date.getSeconds() === 0 && date.getMilliseconds() === 0;
  if (midnight) return day;
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${day} ${hour12}:${minutes} ${suffix}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === 'true') return true;
    if (text === 'false') return false;
  }
  return null;
}

function asStatus(value: unknown): QcStatus {
  const text = asString(value).toUpperCase().replace(/\s+/g, '_');
  if (text === 'OPEN' || text === 'IN_PROGRESS' || text === 'RESOLVED') return text;
  return 'UNKNOWN';
}

function asCategories(value: unknown): QcCategoryCount[] {
  if (!Array.isArray(value)) return [];
  const rows: QcCategoryCount[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const category = asString(record.category);
    if (!category) continue;
    rows.push({ category, count: asCount(record.count) });
  }
  return rows;
}

function asParts(value: unknown): QcPartCount[] {
  if (!Array.isArray(value)) return [];
  const rows: QcPartCount[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const partNumber = asString(record.part_number);
    if (!partNumber) continue;
    rows.push({
      partNumber,
      partDescription: asString(record.part_description),
      count: asCount(record.count),
    });
  }
  return rows;
}

function asPatterns(value: unknown): QcRepeatPattern[] {
  if (!Array.isArray(value)) return [];
  const rows: QcRepeatPattern[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const partNumber = asString(record.part_number);
    const category = asString(record.category);
    if (!partNumber && !category) continue;
    rows.push({ partNumber, category, count: asCount(record.count) });
  }
  return rows;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(item => item.length > 0);
}

function asAction(value: unknown): QcAction | null {
  const record = asRecord(value);
  if (!record) return null;
  const text = asString(record.text);
  const by = asString(record.by);
  const at = readQcDate(record.at);
  if (!text && !by && !at) return null;
  return { text, by, at };
}

function asIncident(value: unknown): QcIncident | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    incidentCode: asString(record.incident_code),
    createdAt: readQcDate(record.created_at),
    status: asStatus(record.status),
    partNumber: asString(record.part_number),
    partDescription: asString(record.part_description),
    jobNumber: asString(record.job_number),
    machine: asString(record.machine),
    shiftName: asString(record.shift_name),
    categories: asStringList(record.categories),
    problem: asString(record.problem),
    latestAction: asAction(record.latest_action),
    actionCount: asCount(record.action_count),
    mediaCount: asCount(record.media_count),
    resolvedAt: readQcDate(record.resolved_at),
  };
}

export function parseQcEmployee(docId: string, data: unknown): QcEmployeeHistory | null {
  const record = asRecord(data);
  if (!record) return null;
  const employeeId = normalizeEmployeeId(asString(docId)) ?? normalizeEmployeeId(asString(record.employee_id));
  if (!employeeId) return null;

  const incidents = Array.isArray(record.incidents)
    ? record.incidents.map(asIncident).filter((item): item is QcIncident => item != null)
    : [];

  return {
    employeeId,
    employeeName: asString(record.employee_name),
    incidentCount: asCount(record.incident_count) || incidents.length,
    openCount: asCount(record.open_count),
    resolvedCount: asCount(record.resolved_count),
    latestIncidentAt: readQcDate(record.latest_incident_at),
    categories: asCategories(record.categories),
    parts: asParts(record.parts),
    repeatedPatterns: asPatterns(record.repeated_patterns),
    incidents,
    syncedAt: readQcDate(record.synced_at),
  };
}

export function parseQcSummary(data: unknown): QcSummary | null {
  const record = asRecord(data);
  if (!record) return null;
  return {
    generatedAt: readQcDate(record.generated_at),
    syncedAt: readQcDate(record.synced_at),
    employeeCount: asCount(record.employee_count),
    incidentCount: asCount(record.incident_count),
    openCount: asCount(record.open_count),
    repeatEmployeeCount: asCount(record.repeat_employee_count),
    categories: asCategories(record.categories),
    lastRunOk: asBool(record.last_run_ok),
  };
}
