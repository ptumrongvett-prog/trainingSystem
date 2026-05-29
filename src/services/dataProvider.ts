/**
 * dataProvider.ts — Data orchestrator with fallback chain.
 * Strategy: AppSheet → Google Sheets → Sample Data.
 * Never crashes — always returns usable data.
 */

import type { AppData, DataSourceType, DataMeta, DataError, Topic, Assignment } from '../types';
import * as appsheet from './appsheetApi';
import * as sheets from './googleSheetsApi';
import { buildSampleData } from '../data/sampleData';
import { setCache, getCache, clearAllCache } from './cacheManager';
import { registerTopic } from '../lib/topicMap';

const CACHE_KEY = 'all_data';

export interface LoadResult {
  data: AppData;
  meta: DataMeta;
}

/**
 * Load all data using the specified strategy.
 * 'auto' tries: appsheet → google → sample (never fails).
 */
export async function loadAllData(
  source: DataSourceType = 'auto',
  forceRefresh = false,
): Promise<LoadResult> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCache<LoadResult>(CACHE_KEY);
    if (cached) {
      return { ...cached, meta: { ...cached.meta, cached: true } };
    }
  }

  const errors: DataError[] = [];
  let data: AppData | null = null;
  let actualSource: DataSourceType = source;

  // Strategy execution
  if (source === 'appsheet' || source === 'auto') {
    data = await tryAppSheet(errors);
    if (data) {
      actualSource = 'appsheet';
    } else if (source === 'auto') {
      // Fallback to Google Sheets
      data = await tryGoogleSheets(errors);
      if (data) {
        actualSource = 'google';
      }
    }
  }

  if (!data && (source === 'google' || source === 'auto')) {
    if (source === 'google') {
      data = await tryGoogleSheets(errors);
      if (data) actualSource = 'google';
    }
  }

  // Final fallback: sample data
  if (!data) {
    if (source !== 'sample' && source !== 'auto') {
      errors.push({ source, table: '*', message: `${source} data source failed` });
    }
    data = buildSampleData();
    actualSource = 'sample';
  }

  const result: LoadResult = {
    data,
    meta: {
      source: actualSource,
      loadedAt: new Date(),
      errors,
      cached: false,
    },
  };

  // Cache the result (not for sample data)
  if (actualSource !== 'sample') {
    setCache(CACHE_KEY, result);
  }

  return result;
}

/**
 * Register topic names from raw Topic rows.
 * Called after data load to populate the topic registry.
 */
export function hydrateTopicNames(topics: Topic[]): void {
  for (const t of topics) {
    if (t.TopicID) {
      registerTopic(t.TopicID, {
        name: t.Title || '',
        category: 'General',
        frequency: 'annual',
        requiredBy: ['all'],
      });
    }
  }
}

/** Clear cache and force reload */
export function invalidateCache(): void {
  clearAllCache();
}

/**
 * Normalize AppSheet column aliases to our internal field names.
 * AppSheet uses: AssignDate (not DateAssigned), BatchID (not RequestID),
 * and has no IsActive field (default to active).
 */
function normalizeAssignments(raw: Record<string, unknown>[]): Assignment[] {
  return raw.map(r => ({
    AssignmentID: String(r.AssignmentID || ''),
    EmpKey: String(r.EmpKey || ''),
    TopicID: String(r.TopicID || ''),
    DateAssigned: String(r.DateAssigned || r.AssignDate || ''),
    AssignMode: String(r.AssignMode || ''),
    DueDate: String(r.DueDate || ''),
    Status: String(r.Status || ''),
    RequestID: String(r.RequestID || r.BatchID || ''),
    IsActive: r.IsActive !== undefined ? r.IsActive : true,  // missing = active
  })) as Assignment[];
}

/* ─── Internal Fetch Strategies ─── */

async function tryAppSheet(errors: DataError[]): Promise<AppData | null> {
  try {
    const results = await Promise.all([
      appsheet.fetchEmployees(),
      appsheet.fetchAssignments(),
      appsheet.fetchAssignRequests(),
      appsheet.fetchQuizQuestions(),
      appsheet.fetchQuizResponses(),
      appsheet.fetchSessions(),
      appsheet.fetchCheckMissing(),
      appsheet.fetchSummary(),
      appsheet.fetchTopics(),
    ]);

    const [employees, assignments, assignRequests, quizQuestions, quizResponses, sessions, checkMissing, summary, topics] = results;

    // Check if any critical table failed
    const criticalFailed = [employees, assignments].some(r => r.data === null);
    if (criticalFailed) {
      for (const r of results) {
        if (r.error) {
          errors.push({ source: 'appsheet', table: 'unknown', message: r.error, status: r.status });
        }
      }
      return null;
    }

    // Register topic names (non-critical — silent fail OK)
    if (topics.data && topics.data.length > 0) {
      hydrateTopicNames(topics.data);
    }

    return {
      employees: employees.data || [],
      assignments: normalizeAssignments((assignments.data || []) as unknown as Record<string, unknown>[]),
      assignRequests: assignRequests.data || [],
      quizQuestions: quizQuestions.data || [],
      quizResponses: quizResponses.data || [],
      sessions: sessions.data || [],
      checkMissing: checkMissing.data || [],
      summary: summary.data || [],
    };
  } catch (err) {
    errors.push({ source: 'appsheet', table: '*', message: (err as Error).message });
    return null;
  }
}

async function tryGoogleSheets(errors: DataError[]): Promise<AppData | null> {
  try {
    const results = await Promise.all([
      sheets.fetchEmployeesFromSheets(),
      sheets.fetchAssignmentsFromSheets(),
      sheets.fetchAssignRequestsFromSheets(),
      sheets.fetchQuizQuestionsFromSheets(),
      sheets.fetchQuizResponsesFromSheets(),
      sheets.fetchSessionsFromSheets(),
      sheets.fetchCheckMissingFromSheets(),
      sheets.fetchSummaryFromSheets(),
    ]);

    const [employees, assignments, assignRequests, quizQuestions, quizResponses, sessions, checkMissing, summary] = results;

    const criticalFailed = [employees, assignments].some(r => r.data === null);
    if (criticalFailed) {
      for (const r of results) {
        if (r.error) {
          errors.push({ source: 'google', table: 'unknown', message: r.error });
        }
      }
      return null;
    }

    return {
      employees: (employees.data || []) as AppData['employees'],
      assignments: (assignments.data || []) as AppData['assignments'],
      assignRequests: (assignRequests.data || []) as AppData['assignRequests'],
      quizQuestions: (quizQuestions.data || []) as AppData['quizQuestions'],
      quizResponses: (quizResponses.data || []) as AppData['quizResponses'],
      sessions: (sessions.data || []) as AppData['sessions'],
      checkMissing: (checkMissing.data || []) as AppData['checkMissing'],
      summary: (summary.data || []) as AppData['summary'],
    };
  } catch (err) {
    errors.push({ source: 'google', table: '*', message: (err as Error).message });
    return null;
  }
}
