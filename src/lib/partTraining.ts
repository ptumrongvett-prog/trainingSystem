/**
 * Part training aggregation.
 *
 * One output row per unique (employee id, part number) from FN-112_Training Log.
 * Cleaning rules:
 * - trim part numbers; a cell with several lines stays one part, joined with " / "
 * - employee ids: trim, drop thousands commas ("1,400" -> "1400"), and
 *   canonicalize numeric text so "06876" and 6876 match
 * - skip rows with a blank employee id or part number
 * - count only real calendar dates from 2015-01-01 through `today` (inclusive)
 *   Two-digit years are read as 20xx ("5/3/23" -> 2023-05-03). Text, impossible
 *   dates, and typos such as "10/24/0223" or "5/1/20223" are ignored.
 */

export interface RawTrainingRow {
  part: string;
  empId: string;
  empName: string;
  trainingDate: string;
}

export interface PartTrainingPair {
  empId: string;
  employeeName: string;
  active: boolean;
  partNumber: string;
  entryCount: number;
  /** ISO date yyyy-mm-dd */
  firstDate: string;
  /** ISO date yyyy-mm-dd */
  latestDate: string;
}

export interface EmployeePartSummary {
  empId: string;
  employeeName: string;
  active: boolean;
  partCount: number;
  entryCount: number;
  firstDate: string;
  latestDate: string;
  parts: PartTrainingPair[];
}

export interface PartTrainingReport {
  pairs: PartTrainingPair[];
  employees: EmployeePartSummary[];
  sourceRows: number;
  countedRows: number;
  skippedRows: number;
}

const MIN_DATE = new Date(2015, 0, 1);

/** Collapse whitespace and trim a person's name. */
export function cleanPersonName(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Normalize an employee id.
 * Returns null when the value is blank.
 */
export function normalizeEmployeeId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/,/g, '').replace(/ /g, '').replace(/\.0+$/, '');
  if (/^\d+$/.test(compact)) {
    const asNumber = Number(compact);
    if (Number.isSafeInteger(asNumber)) return String(asNumber);
    return compact.replace(/^0+(?=\d)/, '');
  }

  return trimmed;
}

/**
 * Normalize a part number.
 * Blank values become null. Line breaks inside one cell stay a single part.
 */
export function normalizePartNumber(value: string | null | undefined): string | null {
  if (value == null) return null;
  const part = value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' / ')
    .trim();
  return part.length > 0 ? part : null;
}

/**
 * Parse a training-log date.
 * Accepts M/D/YYYY, M/D/YY (as 20YY), optional time, and YYYY-MM-DD.
 * Returns null for blank, text, impossible, or out-of-range dates.
 */
export function parseTrainingDate(value: string | null | undefined, today: Date): Date | null {
  if (value == null) return null;
  const text = value.trim();
  if (!text) return null;

  let year: number;
  let month: number;
  let day: number;

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(text);
  const usShort = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(text);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(text);

  if (us) {
    month = Number(us[1]);
    day = Number(us[2]);
    year = Number(us[3]);
  } else if (usShort) {
    month = Number(usShort[1]);
    day = Number(usShort[2]);
    year = 2000 + Number(usShort[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date < MIN_DATE || date > todayOnly) return null;
  return date;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Display an ISO date as M/D/YYYY, matching the training log. */
export function formatTrainingDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
}

function compareEmpId(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) {
    const delta = Number(a) - Number(b);
    if (delta !== 0) return delta;
  } else if (aNumeric !== bNumeric) {
    return aNumeric ? -1 : 1;
  }
  return a.localeCompare(b);
}

function comparePart(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

interface Accumulator {
  count: number;
  first: string;
  latest: string;
}

interface LogName {
  name: string;
  asOf: string;
}

/**
 * Aggregate raw log rows to one pair per employee and part.
 * `activeEmployees` maps a normalized employee id to the Employee-tab name.
 * An id present in that map is active; everyone else is not, and keeps the
 * name from the latest counted log row.
 */
export function aggregatePartTraining(
  rows: readonly RawTrainingRow[],
  activeEmployees: ReadonlyMap<string, string>,
  today: Date,
): PartTrainingReport {
  const grouped = new Map<string, Map<string, Accumulator>>();
  const logNames = new Map<string, LogName>();

  let countedRows = 0;
  for (const row of rows) {
    const empId = normalizeEmployeeId(row.empId);
    const partNumber = normalizePartNumber(row.part);
    const date = parseTrainingDate(row.trainingDate, today);
    if (!empId || !partNumber || !date) continue;

    countedRows += 1;
    const iso = toIsoDate(date);
    const logName = cleanPersonName(row.empName);
    if (logName) {
      const previous = logNames.get(empId);
      if (!previous || iso >= previous.asOf) logNames.set(empId, { name: logName, asOf: iso });
    }

    let parts = grouped.get(empId);
    if (!parts) {
      parts = new Map();
      grouped.set(empId, parts);
    }
    const existing = parts.get(partNumber);
    if (!existing) {
      parts.set(partNumber, { count: 1, first: iso, latest: iso });
      continue;
    }
    existing.count += 1;
    if (iso < existing.first) existing.first = iso;
    if (iso > existing.latest) existing.latest = iso;
  }

  const pairs: PartTrainingPair[] = [];
  for (const [empId, parts] of grouped) {
    const active = activeEmployees.has(empId);
    const directoryName = cleanPersonName(activeEmployees.get(empId));
    const employeeName = active && directoryName ? directoryName : (logNames.get(empId)?.name ?? '');
    for (const [partNumber, acc] of parts) {
      pairs.push({
        empId,
        employeeName,
        active,
        partNumber,
        entryCount: acc.count,
        firstDate: acc.first,
        latestDate: acc.latest,
      });
    }
  }

  pairs.sort((a, b) => compareEmpId(a.empId, b.empId) || comparePart(a.partNumber, b.partNumber));

  const employees: EmployeePartSummary[] = [];
  for (const pair of pairs) {
    const last = employees[employees.length - 1];
    if (!last || last.empId !== pair.empId) {
      employees.push({
        empId: pair.empId,
        employeeName: pair.employeeName,
        active: pair.active,
        partCount: 1,
        entryCount: pair.entryCount,
        firstDate: pair.firstDate,
        latestDate: pair.latestDate,
        parts: [pair],
      });
      continue;
    }
    last.partCount += 1;
    last.entryCount += pair.entryCount;
    if (pair.firstDate < last.firstDate) last.firstDate = pair.firstDate;
    if (pair.latestDate > last.latestDate) last.latestDate = pair.latestDate;
    if (!last.employeeName && pair.employeeName) last.employeeName = pair.employeeName;
    last.parts.push(pair);
  }

  return {
    pairs,
    employees,
    sourceRows: rows.length,
    countedRows,
    skippedRows: rows.length - countedRows,
  };
}
