/**
 * appsheetApi.ts — AppSheet REST API client.
 * Primary data source for the training compliance system.
 */

import type { Employee, Assignment, AssignRequest, QuizQuestion, QuizResponse, Session, CheckMissing, SummaryRow, Topic } from '../types';

const APP_ID  = import.meta.env.VITE_APPSHEET_APP_ID  || '';
const API_KEY = import.meta.env.VITE_APPSHEET_API_KEY || '';
const BASE    = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables`;

interface FetchResult<T> {
  data: T[] | null;
  error: string | null;
  status: number;
}

/**
 * Generic table fetch via AppSheet Find action.
 */
async function fetchTable<T>(tableName: string, selector?: string): Promise<FetchResult<T>> {
  if (!APP_ID || !API_KEY) {
    return { data: null, error: 'AppSheet APP_ID or API_KEY not configured', status: 0 };
  }

  const body: Record<string, unknown> = {
    Action: 'Find',
    Properties: {
      Locale: 'en-US',
      Timezone: 'Pacific Standard Time',
    },
    Rows: [],
  };

  if (selector) {
    (body.Properties as Record<string, string>).Selector = selector;
  }

  try {
    const response = await fetch(`${BASE}/${tableName}/Action`, {
      method: 'POST',
      headers: {
        'ApplicationAccessKey': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { data: null, error: `HTTP ${response.status}: ${text.substring(0, 200)}`, status: response.status };
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      return { data: [], error: null, status: response.status };
    }

    const data = JSON.parse(text) as T[];
    return { data, error: null, status: response.status };
  } catch (err) {
    return { data: null, error: `Network error: ${(err as Error).message}`, status: 0 };
  }
}

/* ─── Table-Specific Fetchers ─── */

export async function fetchEmployees(): Promise<FetchResult<Employee>> {
  return fetchTable<Employee>('Employees');
}

export async function fetchAssignments(): Promise<FetchResult<Assignment>> {
  return fetchTable<Assignment>('Assignments');
}

export async function fetchAssignRequests(): Promise<FetchResult<AssignRequest>> {
  return fetchTable<AssignRequest>('AssignRequests');
}

export async function fetchQuizQuestions(): Promise<FetchResult<QuizQuestion>> {
  return fetchTable<QuizQuestion>('QuizQuestions');
}

export async function fetchQuizResponses(): Promise<FetchResult<QuizResponse>> {
  return fetchTable<QuizResponse>('QuizResponses');
}

export async function fetchSessions(): Promise<FetchResult<Session>> {
  return fetchTable<Session>('Sessions');
}

export async function fetchCheckMissing(): Promise<FetchResult<CheckMissing>> {
  return fetchTable<CheckMissing>('checkMissingTopicAssign');
}

export async function fetchSummary(): Promise<FetchResult<SummaryRow>> {
  return fetchTable<SummaryRow>('Summary');
}

export async function fetchTopics(): Promise<FetchResult<Topic>> {
  return fetchTable<Topic>('Topics');
}

/** Quick connectivity check */
export async function testConnection(): Promise<{ ok: boolean; status: number; error?: string }> {
  const result = await fetchTable('Employees', "Filter(Employees, [_RowNumber] <= 1)");
  return {
    ok: result.data !== null,
    status: result.status,
    error: result.error || undefined,
  };
}
