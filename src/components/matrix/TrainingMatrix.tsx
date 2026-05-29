import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { buildMatrix, matrixToExportData } from '../../lib/matrixHelpers';
import { STATUS_COLORS, STATUS_LABELS } from '../../lib/statusRules';
import { isTopicNameMissing } from '../../lib/topicMap';
import { ComplianceStatus } from '../../types';
import type { QuizResponse, QuizQuestion } from '../../types';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

function buildQuizScoreMap(questions: QuizQuestion[], responses: QuizResponse[]) {
  // Map QuestionID -> TopicID
  const qTopicMap = new Map<string, string>();
  for (const q of questions) qTopicMap.set(q.QuestionID, q.TopicID);

  // Build empKey|topicId -> { correct, total }
  const scoreMap = new Map<string, { correct: number; total: number }>();
  for (const r of responses) {
    const topicId = qTopicMap.get(r.QuestionID);
    if (!topicId) continue;
    const key = `${r.EmpKey}|${topicId}`;
    const stat = scoreMap.get(key) || { correct: 0, total: 0 };
    stat.total++;
    if (r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y') stat.correct++;
    scoreMap.set(key, stat);
  }
  return scoreMap;
}

const ROW_HEIGHT = 36;
const OVERSCAN = 5;

export default function TrainingMatrix() {
  const { data, filteredData } = useDataStore();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Filters
  const [deptFilter, setDeptFilter] = useState('');
  const [empSearch, setEmpSearch] = useState('');

  // Build matrix (memoized)
  const { rows: allRows, topicIds } = useMemo(
    () => buildMatrix(filteredData.employees, filteredData.assignments),
    [filteredData.employees, filteredData.assignments]
  );

  // Quiz scores per employee per topic
  const quizScoreMap = useMemo(
    () => buildQuizScoreMap(data.quizQuestions, filteredData.quizResponses),
    [data.quizQuestions, filteredData.quizResponses]
  );

  // Unique departments
  const departments = useMemo(() => {
    const depts = new Set(allRows.map(r => r.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [allRows]);

  // Apply local filters
  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (deptFilter) {
      rows = rows.filter(r => r.department === deptFilter);
    }
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase().trim();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.empKey.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allRows, deptFilter, empSearch]);

  // Compute completion % per row
  const rowCompletion = useMemo(() => {
    const map = new Map<string, { completed: number; total: number }>();
    for (const row of filteredRows) {
      let completed = 0;
      let total = 0;
      for (const status of row.cells.values()) {
        if (status !== ComplianceStatus.NOT_ASSIGNED) {
          total++;
          if (status === ComplianceStatus.COMPLETED) completed++;
        }
      }
      map.set(row.empKey, { completed, total });
    }
    return map;
  }, [filteredRows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = useMemo(
    () => filteredRows.slice(page * pageSize, (page + 1) * pageSize),
    [filteredRows, page, pageSize]
  );

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [deptFilter, empSearch]);

  // Virtualization via scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const clientHeight = containerRef.current.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(paginatedRows.length, Math.ceil((scrollTop + clientHeight) / ROW_HEIGHT) + OVERSCAN);
    setVisibleRange({ start, end });
  }, [paginatedRows.length]);

  useEffect(() => {
    handleScroll();
  }, [paginatedRows, handleScroll]);

  // Export
  const exportData = useMemo(
    () => matrixToExportData(filteredRows, topicIds),
    [filteredRows, topicIds]
  );

  // Status summary
  const statusCounts = useMemo(() => {
    const counts = new Map<ComplianceStatus, number>();
    for (const row of filteredRows) {
      for (const status of row.cells.values()) {
        counts.set(status, (counts.get(status) || 0) + 1);
      }
    }
    return counts;
  }, [filteredRows]);

  if (allRows.length === 0) {
    return <EmptyState icon="👥" title="No Employees" message="No employees found with current filters." />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Training Matrix</h1>
        <div className="actions">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filteredRows.length} employees × {topicIds.length} topics
          </span>
          <ExportButton data={exportData} filename="training_matrix" />
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Department filter */}
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          style={{
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem', fontFamily: 'var(--font)', minWidth: 160,
          }}
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Employee search */}
        <div style={{ position: 'relative', flex: '0 1 250px' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>🔍</span>
          <input
            type="text"
            value={empSearch}
            onChange={e => setEmpSearch(e.target.value)}
            placeholder="Search employee name or ID..."
            style={{
              width: '100%', padding: '7px 12px 7px 30px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem', fontFamily: 'var(--font)', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Clear filters */}
        {(deptFilter || empSearch) && (
          <button
            onClick={() => { setDeptFilter(''); setEmpSearch(''); }}
            style={{
              padding: '7px 14px', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)',
              color: '#f87171', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'var(--font)',
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.values(ComplianceStatus).map(s => {
          const count = statusCounts.get(s) || 0;
          if (count === 0) return null;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: STATUS_COLORS[s] }} />
              {STATUS_LABELS[s]} ({count})
            </div>
          );
        })}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState icon="🔍" title="No Results" message="No employees match the current filters." />
      ) : (
        /* Matrix Table */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{ maxHeight: 600, overflowY: 'auto', overflowX: 'auto' }}
          >
            <table className="data-table" style={{ minWidth: 480 + topicIds.length * 80 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-secondary)', minWidth: 180 }}>Employee</th>
                  <th style={{ position: 'sticky', left: 180, zIndex: 10, background: 'var(--bg-secondary)', minWidth: 100 }}>Dept</th>
                  <th style={{ minWidth: 50 }}>Div</th>
                  <th style={{ minWidth: 40 }}>Shift</th>
                  <th style={{ minWidth: 60, textAlign: 'center' }}>%</th>
                  {topicIds.map(t => (
                    <th key={t} style={{ textAlign: 'center', minWidth: 80, fontSize: '0.7rem' }}>
                      {t}
                      {isTopicNameMissing(t) && <span style={{ color: 'var(--amber)' }}> ⚠</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Spacer for virtualization */}
                {visibleRange.start > 0 && (
                  <tr><td colSpan={5 + topicIds.length} style={{ height: visibleRange.start * ROW_HEIGHT, padding: 0, border: 'none' }} /></tr>
                )}
                {paginatedRows.slice(visibleRange.start, visibleRange.end).map(row => {
                  const comp = rowCompletion.get(row.empKey);
                  const pct = comp && comp.total > 0 ? (comp.completed / comp.total) * 100 : 0;
                  const pctColor = pct >= 95 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : 'var(--red)';
                  return (
                    <tr key={row.empKey} style={{ height: ROW_HEIGHT }}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', fontWeight: 500, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {row.name}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>{row.empKey}</span>
                      </td>
                      <td style={{ position: 'sticky', left: 180, background: 'var(--bg-card)', fontSize: '0.8rem' }}>{row.department}</td>
                      <td style={{ fontSize: '0.8rem' }}>{row.division}</td>
                      <td style={{ fontSize: '0.8rem' }}>{row.shift}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.82rem', color: pctColor }}>
                        {comp && comp.total > 0 ? `${pct.toFixed(0)}%` : '—'}
                      </td>
                      {topicIds.map(t => {
                        const status = row.cells.get(t) || ComplianceStatus.NOT_ASSIGNED;
                        const quizKey = `${row.empKey}|${t}`;
                        const quiz = quizScoreMap.get(quizKey);
                        const quizPct = quiz && quiz.total > 0 ? (quiz.correct / quiz.total) * 100 : null;
                        return (
                          <td key={t} style={{ textAlign: 'center', padding: 4 }}>
                            <div
                              title={`${row.name} — ${t}: ${STATUS_LABELS[status]}${quizPct !== null ? ` | Quiz: ${quizPct.toFixed(0)}%` : ''}`}
                              style={{
                                width: '100%', height: 24, borderRadius: 4,
                                background: STATUS_COLORS[status],
                                opacity: status === ComplianceStatus.NOT_ASSIGNED ? 0.2 : 0.85,
                                cursor: 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                position: 'relative',
                              }}
                            >
                              {quizPct !== null && status !== ComplianceStatus.NOT_ASSIGNED && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  color: '#fff',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                                  lineHeight: 1,
                                }}>
                                  {quizPct.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Bottom spacer */}
                {visibleRange.end < paginatedRows.length && (
                  <tr><td colSpan={5 + topicIds.length} style={{ height: (paginatedRows.length - visibleRange.end) * ROW_HEIGHT, padding: 0, border: 'none' }} /></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rows per page:</span>
              {[50, 100, 200].map(size => (
                <button key={size} className={`btn ${pageSize === size ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                  onClick={() => { setPageSize(size); setPage(0); }}>
                  {size}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '3px 10px' }}>← Prev</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '3px 10px' }}>Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
