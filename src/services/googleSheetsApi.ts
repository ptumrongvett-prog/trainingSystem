/**
 * googleSheetsApi.ts — Fallback data source using public Google Sheets.
 * Uses the Google Visualization API (no auth required for public sheets).
 */

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '';

interface SheetResult<T> {
  data: T[] | null;
  error: string | null;
}

/**
 * Fetch a sheet tab using Google Visualization API (returns JSON).
 * Works for public/anyone-with-link sheets without OAuth.
 */
async function fetchSheet<T>(sheetName: string): Promise<SheetResult<T>> {
  if (!SHEET_ID) {
    return { data: null, error: 'Google Sheet ID not configured' };
  }

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { data: null, error: `HTTP ${response.status}` };
    }

    const text = await response.text();

    // Google returns JSONP-like: google.visualization.Query.setResponse({...})
    const jsonStr = text.replace(/^[^(]*\(/, '').replace(/\);?\s*$/, '');
    const parsed = JSON.parse(jsonStr);

    if (parsed.status === 'error') {
      return { data: null, error: parsed.errors?.[0]?.message || 'Sheet error' };
    }

    const table = parsed.table;
    if (!table || !table.cols || !table.rows) {
      return { data: [], error: null };
    }

    // Convert to array of objects
    const headers: string[] = table.cols.map((c: { label: string; id: string }) => c.label || c.id);
    const rows: T[] = table.rows.map((row: { c: Array<{ v: unknown } | null> }) => {
      const obj: Record<string, unknown> = {};
      row.c.forEach((cell: { v: unknown } | null, i: number) => {
        const key = headers[i];
        if (key) {
          obj[key] = cell?.v ?? '';
        }
      });
      return obj as T;
    });

    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: `Fetch error: ${(err as Error).message}` };
  }
}

/* ─── Sheet-Specific Fetchers ─── */

export async function fetchEmployeesFromSheets() { return fetchSheet('Employees'); }
export async function fetchAssignmentsFromSheets() { return fetchSheet('Assignments'); }
export async function fetchAssignRequestsFromSheets() { return fetchSheet('AssignRequests'); }
export async function fetchQuizQuestionsFromSheets() { return fetchSheet('QuizQuestions'); }
export async function fetchQuizResponsesFromSheets() { return fetchSheet('QuizResponses'); }
export async function fetchSessionsFromSheets() { return fetchSheet('Sessions'); }
export async function fetchCheckMissingFromSheets() { return fetchSheet('checkMissingTopicAssign'); }
export async function fetchSummaryFromSheets() { return fetchSheet('Summary'); }

export async function testSheetsConnection(): Promise<boolean> {
  const result = await fetchSheet('Employees');
  return result.data !== null;
}
