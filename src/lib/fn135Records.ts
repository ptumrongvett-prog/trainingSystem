/**
 * FN-135 form submissions stored in Firestore `fn135_records`
 * by the trainer form (trainingSheets.submitTrainingLog).
 * Read-only here. One submission can cover several employees.
 */

import { normalizeEmployeeId } from './partTraining';
import { readQcDate } from './qcContract';

export interface Fn135Submission {
  recordId: string;
  createdAt: Date | null;
  documentNumber: string;
  partNumber: string;
  trainerName: string;
  passed: boolean | null;
  comments: string;
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

function asPassed(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === 'true' || text === 'pass' || text === 'yes') return true;
    if (text === 'false' || text === 'fail' || text === 'no') return false;
  }
  return null;
}

/** Keep submissions whose employee id matches, newest first. */
export function parseFn135ForEmployee(docs: readonly unknown[], empId: string): Fn135Submission[] {
  const wanted = normalizeEmployeeId(empId);
  if (!wanted) return [];

  const rows: Fn135Submission[] = [];
  for (const doc of docs) {
    const record = asRecord(doc);
    if (!record) continue;
    const employees = Array.isArray(record.employees) ? record.employees : [];
    const match = employees
      .map(asRecord)
      .find(employee => employee != null && normalizeEmployeeId(asString(employee.id)) === wanted);
    if (!match) continue;

    rows.push({
      recordId: asString(record.recordId) || asString(record.id),
      createdAt: readQcDate(record.createdAt) ?? readQcDate(record.timestamp),
      documentNumber: asString(record.documentNumber),
      partNumber: asString(record.partNumber),
      trainerName: asString(record.trainerName),
      passed: asPassed(match.passed),
      comments: asString(match.comments),
    });
  }

  rows.sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
  return rows;
}
