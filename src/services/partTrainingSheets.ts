/**
 * Read-only loader for the Part Training report.
 *
 * Uses the same public Google Visualization CSV endpoint as FN-135
 * (trainingSheets.ts / TrainingLogView). Nothing is written to the sheet.
 * The log is about 76,000 rows, so it is downloaded in column-limited chunks
 * and aggregated in the browser.
 */
import Papa from 'papaparse';
import { cleanPersonName, normalizeEmployeeId, type RawTrainingRow } from '../lib/partTraining';

const TRAINING_SHEET_ID = '1lebYzX9dI7cs6L8yk43pwmvXGXSBIU359uqiePcO5BQ';
const LOG_SHEET = 'FN-112_Training Log';
const EMPLOYEE_SHEET = 'Employee';

/** Header is row 4; data starts on row 5. */
const DATA_START_ROW = 5;
const CHUNK_ROWS = 10000;
const CHUNKS_PER_WAVE = 4;
/** Stop if a whole wave is empty. A gap this large does not occur in the log. */
const MAX_START_ROW = 300000;

export interface PartTrainingSource {
  rows: RawTrainingRow[];
  /** Normalized employee id -> "First Last" from the Employee tab. Presence means active. */
  activeEmployees: Map<string, string>;
}

export interface LoadOptions {
  force?: boolean;
  onProgress?: (loadedRows: number) => void;
}

let cache: PartTrainingSource | null = null;
let inflight: Promise<PartTrainingSource> | null = null;
let generation = 0;

function sheetCsvUrl(sheet: string, extra: string): string {
  return `https://docs.google.com/spreadsheets/d/${TRAINING_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}${extra}`;
}

function parseCsv(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  if (!cleaned.trim()) return [];
  const head = cleaned.slice(0, 400);
  if (/<(html|!doctype)/i.test(head) || head.includes('google.visualization.Query.setResponse')) {
    throw new Error(
      'Google Sheets did not return the training log. The spreadsheet has to stay shared so anyone with the link can view it (the same access FN-135 uses).',
    );
  }
  const parsed = Papa.parse<string[]>(cleaned, { header: false, skipEmptyLines: 'greedy' });
  const fatal = parsed.errors.find(error => error.type === 'Quotes');
  if (fatal) {
    throw new Error(`Could not parse the sheet CSV (${fatal.message}).`);
  }
  return parsed.data;
}

async function fetchCsv(url: string): Promise<string[][]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) {
    throw new Error(`Google Sheets request failed (HTTP ${response.status}).`);
  }
  return parseCsv(await response.text());
}

async function fetchLogChunk(startRow: number, endRow: number): Promise<RawTrainingRow[]> {
  const query = encodeURIComponent('SELECT B, E, F, J');
  const url = sheetCsvUrl(
    LOG_SHEET,
    `&headers=0&range=A${startRow}:J${endRow}&tq=${query}`,
  );
  const table = await fetchCsv(url);
  return table.map(cells => ({
    part: cells[0] ?? '',
    empId: cells[1] ?? '',
    empName: cells[2] ?? '',
    trainingDate: cells[3] ?? '',
  }));
}

async function fetchActiveEmployees(): Promise<Map<string, string>> {
  const table = await fetchCsv(sheetCsvUrl(EMPLOYEE_SHEET, '&headers=1'));
  if (table.length === 0) return new Map();

  const headers = table[0].map(header => header.trim().toLowerCase());
  const idIndex = headers.indexOf('employee_number');
  const firstIndex = headers.indexOf('first_name');
  const lastIndex = headers.indexOf('last_name');
  if (idIndex < 0) {
    throw new Error('The Employee sheet is missing the employee_number column.');
  }

  const active = new Map<string, string>();
  for (const cells of table.slice(1)) {
    const empId = normalizeEmployeeId(cells[idIndex] ?? '');
    if (!empId) continue;
    const first = firstIndex >= 0 ? cells[firstIndex] ?? '' : '';
    const last = lastIndex >= 0 ? cells[lastIndex] ?? '' : '';
    const name = cleanPersonName(`${first} ${last}`);
    if (!active.has(empId) || name) active.set(empId, name);
  }
  return active;
}

async function fetchAllLogRows(onProgress?: (loadedRows: number) => void): Promise<RawTrainingRow[]> {
  const rows: RawTrainingRow[] = [];
  let start = DATA_START_ROW;

  while (start < MAX_START_ROW) {
    const starts = Array.from({ length: CHUNKS_PER_WAVE }, (_, index) => start + index * CHUNK_ROWS);
    const chunks = await Promise.all(
      starts.map(chunkStart => fetchLogChunk(chunkStart, chunkStart + CHUNK_ROWS - 1)),
    );
    const waveCount = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (waveCount === 0) break;
    for (const chunk of chunks) rows.push(...chunk);
    onProgress?.(rows.length);
    start += CHUNKS_PER_WAVE * CHUNK_ROWS;
  }

  if (start >= MAX_START_ROW) {
    throw new Error('The training log is larger than this report can read in one pass.');
  }
  return rows;
}

/** Load log rows and the active-employee directory. Cached for the browser session. */
export function loadPartTrainingSource(options: LoadOptions = {}): Promise<PartTrainingSource> {
  if (options.force) {
    cache = null;
    inflight = null;
    generation += 1;
  }
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  const requestGeneration = generation;
  const pending = Promise.all([
    fetchAllLogRows(options.onProgress),
    fetchActiveEmployees(),
  ]).then(([rows, activeEmployees]) => {
    const source = { rows, activeEmployees };
    if (requestGeneration === generation) cache = source;
    return source;
  }).finally(() => {
    if (inflight === pending) inflight = null;
  });

  inflight = pending;
  return pending;
}

export function clearPartTrainingCache(): void {
  cache = null;
  inflight = null;
  generation += 1;
}
