/**
 * useDataStore.tsx — Central React state management.
 * Provides data, analytics, alerts, insights to all components.
 * Memoizes expensive calculations.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type {
  AppData, DataSourceType, DataMeta, Filters,
  AnalyticsSnapshot, Alert, Insight, ValidationIssue,
} from '../types';
import { Role } from '../types';
import { loadAllData, invalidateCache } from '../services/dataProvider';
import { buildAnalyticsSnapshot } from '../lib/analytics';
import { generateAlerts } from '../lib/alerts';
import { generateInsights } from '../lib/insights';
import { validateAllData } from '../lib/validators';
import { initLocalAuth, switchRole } from '../services/authProvider';
import type { AuthUser } from '../lib/permissions';
import { getCacheTimestamp } from '../services/cacheManager';

/* ─── Filtered Data Helper ─── */

function applyFilters(data: AppData, filters: Filters): AppData {
  let { employees, assignments } = data;

  // Filter employees
  if (filters.department) {
    employees = employees.filter(e => e.department === filters.department);
  }
  if (filters.division) {
    employees = employees.filter(e => e.division === filters.division);
  }
  if (filters.shift) {
    employees = employees.filter(e => e.shift === filters.shift);
  }
  if (filters.supervisor) {
    employees = employees.filter(e => e.supervisor === filters.supervisor);
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    employees = employees.filter(e =>
      e.first_name.toLowerCase().includes(s) ||
      e.last_name.toLowerCase().includes(s) ||
      e.EmpKey.toLowerCase().includes(s) ||
      e.employee_number.includes(s)
    );
  }

  // Filter assignments to match filtered employees
  const empKeySet = new Set(employees.map(e => e.EmpKey));
  assignments = data.assignments.filter(a => empKeySet.has(a.EmpKey));

  if (filters.topic.length > 0) {
    assignments = assignments.filter(a => filters.topic.includes(a.TopicID));
  }
  if (filters.status) {
    assignments = assignments.filter(a => (a.Status || '').toLowerCase() === filters.status.toLowerCase());
  }

  return {
    ...data,
    employees,
    assignments,
    quizResponses: data.quizResponses.filter(r => empKeySet.has(r.EmpKey)),
    sessions: data.sessions.filter(s => empKeySet.has(s.LoggedInEmpKey)),
    checkMissing: data.checkMissing.filter(c => empKeySet.has(c.EmpKey)),
  };
}

/* ─── Context Shape ─── */

interface DataStoreContextType {
  // Raw data
  data: AppData;
  filteredData: AppData;
  meta: DataMeta;
  loading: boolean;
  error: string | null;

  // Computed (memoized)
  analytics: AnalyticsSnapshot;
  alerts: Alert[];
  insights: Insight[];
  validationIssues: ValidationIssue[];

  // Controls
  dataSource: DataSourceType;
  setDataSource: (source: DataSourceType) => void;
  refreshData: () => void;
  lastUpdated: Date | null;

  // Filters
  filters: Filters;
  setFilters: (partial: Partial<Filters>) => void;
  clearFilters: () => void;

  // Auth
  user: AuthUser | null;
  setRole: (role: Role, identifier?: string) => void;
}

const DEFAULT_FILTERS: Filters = {
  dateRange: null,
  department: '',
  division: 'INJ',
  shift: '',
  supervisor: '',
  topic: [],
  status: '',
  search: '',
};

const EMPTY_DATA: AppData = {
  employees: [], assignments: [], assignRequests: [],
  quizQuestions: [], quizResponses: [], sessions: [],
  checkMissing: [], summary: [],
};

const EMPTY_ANALYTICS: AnalyticsSnapshot = {
  completionRate: 0, overdueCount: 0, highRiskDepartments: [],
  missingRequired: [], avgQuizScore: 0,
  mostFailedTopic: { topicId: '', name: 'N/A', failRate: 0 },
  weeklyCompleted: 0, departmentBreakdown: [], divisionBreakdown: [],
  topicBreakdown: [], supervisorSummary: [],
  totalEmployees: 0, totalTopics: 0, totalAssignments: 0,
};

const DataStoreContext = createContext<DataStoreContextType | null>(null);

/* ─── Provider ─── */

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [meta, setMeta] = useState<DataMeta>({ source: 'sample', loadedAt: null, errors: [], cached: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSourceState] = useState<DataSourceType>(
    (import.meta.env.VITE_DATA_SOURCE as DataSourceType) || 'sample'
  );
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [authState, setAuthState] = useState(() => initLocalAuth(Role.ADMIN));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load data
  const doLoad = useCallback(async (source: DataSourceType, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadAllData(source, force);
      setData(result.data);
      setMeta(result.meta);
      setLastUpdated(result.meta.loadedAt);
      if (result.meta.errors.length > 0 && result.meta.source === 'sample' && source !== 'sample') {
        setError(`Could not connect to ${source}. Using sample data. ${result.meta.errors.map(e => e.message).join('; ')}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doLoad(dataSource);
  }, [dataSource, doLoad]);

  // Filtered data (memoized)
  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters]);

  // Analytics (memoized — expensive)
  const analytics = useMemo(() => {
    if (filteredData.employees.length === 0 && filteredData.assignments.length === 0) {
      return EMPTY_ANALYTICS;
    }
    return buildAnalyticsSnapshot(
      filteredData.employees,
      filteredData.assignments,
      filteredData.quizResponses,
      data.quizQuestions,
    );
  }, [filteredData, data.quizQuestions]);

  // Alerts (memoized)
  const alerts = useMemo(() => {
    return generateAlerts(filteredData.assignments, filteredData.employees, filteredData.quizResponses);
  }, [filteredData]);

  // Insights (memoized)
  const insights = useMemo(() => {
    return generateInsights(analytics);
  }, [analytics]);

  // Validation (memoized)
  const validationIssues = useMemo(() => {
    return validateAllData(data.employees, data.assignments, data.quizResponses);
  }, [data]);

  // Handlers
  const setDataSource = useCallback((source: DataSourceType) => {
    invalidateCache();
    setDataSourceState(source);
  }, []);

  const refreshData = useCallback(() => {
    doLoad(dataSource, true);
  }, [dataSource, doLoad]);

  const setFilters = useCallback((partial: Partial<Filters>) => {
    setFiltersState(prev => ({ ...prev, ...partial }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const setRole = useCallback((role: Role, identifier?: string) => {
    setAuthState({ user: switchRole(role, identifier), loading: false, error: null });
  }, []);

  const value: DataStoreContextType = {
    data,
    filteredData,
    meta,
    loading,
    error,
    analytics,
    alerts,
    insights,
    validationIssues,
    dataSource,
    setDataSource,
    refreshData,
    lastUpdated,
    filters,
    setFilters,
    clearFilters,
    user: authState.user,
    setRole,
  };

  return (
    <DataStoreContext.Provider value={value}>
      {children}
    </DataStoreContext.Provider>
  );
}

/* ─── Hook ─── */

export function useDataStore(): DataStoreContextType {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore must be used within DataStoreProvider');
  return ctx;
}
