/**
 * trainingSheets.ts — Read training data from Google Sheets CSV + POST to GAS + Firestore
 */
import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const TRAINING_SHEET_ID = '1lebYzX9dI7cs6L8yk43pwmvXGXSBIU359uqiePcO5BQ';

// GAS Web App URL — replace after deploying Apps Script
let GAS_URL = '';

export function setGasUrl(url: string) { GAS_URL = url; }

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { cells.push(current.trim()); current = ''; }
        else if (ch !== '\r') { current += ch; }
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const cells = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    return obj;
  });
}

async function fetchSheetCSV(sheet: string, range?: string): Promise<Record<string, string>[]> {
  const rangeParam = range ? `&range=${range}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${TRAINING_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}${rangeParam}&_t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${sheet}`);
  const csv = await res.text();
  return parseCSV(csv);
}

export async function fetchEmployees() {
  return fetchSheetCSV('Employee');
}

export async function fetchActiveWI() {
  const data = await fetchSheetCSV('FN199_WI');
  return data.filter(r => (r['STATUS'] || '').toLowerCase() === 'active');
}

export async function fetchActiveQL() {
  const data = await fetchSheetCSV('FN203_QL');
  return data.filter(r => (r['Status'] || '').toLowerCase() === 'active');
}

export async function fetchActiveIC() {
  const data = await fetchSheetCSV('FN310_IC');
  return data.filter(r => (r['STATUS'] || '').toLowerCase() === 'active');
}

export async function fetchPartDescriptions(): Promise<{ part: string; desc: string }[]> {
  if (!GAS_URL) return [];
  try {
    const res = await fetch(GAS_URL + '?action=parts');
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export interface TrainingSubmission {
  trainer: Record<string, string>;
  topic: { type: string; documentNumber: string; description: string; partNumber: string };
  processes?: string[];
  employees: Record<string, string>[];
  results: { passed: boolean; comments: string }[];
  trainerSignature: string;
  operatorSignatures: string[];
}

export async function submitTrainingLog(data: TrainingSubmission): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const recordId = `FN135-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const record = {
      recordId,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      trainerName: `${data.trainer.first_name} ${data.trainer.last_name}`,
      trainerId: data.trainer.employee_number,
      documentNumber: data.topic.documentNumber,
      partNumber: data.topic.partNumber,
      processes: data.processes || [],
      employees: data.employees.map((e, i) => ({
        name: `${e.first_name} ${e.last_name}`,
        id: e.employee_number,
        department: e.department,
        shift: e.shift,
        passed: data.results[i]?.passed,
        comments: data.results[i]?.comments,
        hasSignature: !!data.operatorSignatures[i],
      })),
      trainerHasSignature: !!data.trainerSignature,
    };

    // Save to Firestore
    await addDoc(collection(db, 'fn135_records'), record);

    // Also send to GAS for Google Sheets
    if (GAS_URL) {
      try {
        const res = await fetch(GAS_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'save_training', ...data }),
        });
        const gasResult = await res.json();
        if (gasResult.recordId) return gasResult;
      } catch { /* GAS failed, but Firestore saved */ }
    }

    return { success: true, recordId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
