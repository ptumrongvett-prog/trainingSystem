/**
 * Read-only QC history. The plant PC script writes these documents
 * with the Admin SDK. A missing collection is "not synced yet".
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  parseQcEmployee,
  parseQcSummary,
  type QcEmployeeHistory,
  type QcSummary,
} from '../lib/qcContract';

export type QcLoadResult =
  | { status: 'not_synced' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: QcSummary | null; employees: QcEmployeeHistory[] };

function errorCode(err: unknown): string {
  if (typeof err === 'object' && err && 'code' in err) return String((err as { code: unknown }).code);
  return '';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Could not load QC history.';
}

export async function loadQcHistory(): Promise<QcLoadResult> {
  try {
    const [summarySnap, historySnap] = await Promise.all([
      getDoc(doc(db, 'qc_meta', 'summary')),
      getDocs(collection(db, 'qc_employee_history')),
    ]);

    const summary = summarySnap.exists() ? parseQcSummary(summarySnap.data()) : null;
    const employees = historySnap.docs
      .map(item => parseQcEmployee(item.id, item.data()))
      .filter((item): item is QcEmployeeHistory => item != null);

    if (!summarySnap.exists() && employees.length === 0) return { status: 'not_synced' };

    employees.sort((a, b) => b.incidentCount - a.incidentCount || a.employeeName.localeCompare(b.employeeName));
    return { status: 'ready', summary, employees };
  } catch (err) {
    const code = errorCode(err);
    if (code === 'permission-denied' || code === 'unauthenticated') return { status: 'denied' };
    if (code === 'not-found') return { status: 'not_synced' };
    return { status: 'error', message: errorMessage(err) };
  }
}
