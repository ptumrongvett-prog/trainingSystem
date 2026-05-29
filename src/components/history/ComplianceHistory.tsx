import { useState, useMemo, useCallback } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { buildAuditLog } from '../../lib/auditLogHelpers';
import type { AuditLogEntry } from '../../lib/auditLogHelpers';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  'Training Assigned': 'var(--blue)',
  'Training Completed': 'var(--green)',
  'Quiz Answer': 'var(--purple)',
  'Session Login': 'var(--amber)',
};

export default function ComplianceHistory() {
  const { filteredData } = useDataStore();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(0);

  const allEntries = useMemo(
    () => buildAuditLog(
      filteredData.employees, filteredData.assignments,
      filteredData.quizResponses, filteredData.sessions,
    ),
    [filteredData]
  );

  const filtered = useMemo(() => {
    let list = allEntries;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(e =>
        e.employeeName.toLowerCase().includes(s) ||
        e.empKey.toLowerCase().includes(s) ||
        e.topic.toLowerCase().includes(s)
      );
    }
    if (actionFilter) list = list.filter(e => e.action === actionFilter);
    if (sourceFilter) list = list.filter(e => e.source === sourceFilter);
    return list;
  }, [allEntries, search, actionFilter, sourceFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const clearFilters = useCallback(() => {
    setSearch(''); setActionFilter(''); setSourceFilter(''); setPage(0);
  }, []);

  const actions = [...new Set(allEntries.map(e => e.action))].sort();
  const sources = [...new Set(allEntries.map(e => e.source))].sort();

  const exportData = filtered.map(e => ({
    DateTime: e.dateTimeStr, Employee: e.employeeName, EmpKey: e.empKey,
    Supervisor: e.supervisor, Topic: e.topic, Action: e.action,
    Source: e.source, Score: e.score, Details: e.details,
  }));

  // Action summary
  const actionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of allEntries) {
      counts.set(e.action, (counts.get(e.action) || 0) + 1);
    }
    return counts;
  }, [allEntries]);

  if (allEntries.length === 0) {
    return <EmptyState icon="📋" title="No Audit Data" message="No compliance history available with current filters." />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Compliance History</h1>
        <div className="actions">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filtered.length.toLocaleString()} entries
          </span>
          <ExportButton data={exportData} filename="compliance_history" label="Export" />
        </div>
      </div>

      {/* Action summary cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {actions.map(action => (
          <button
            key={action}
            className={`btn ${actionFilter === action ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActionFilter(prev => prev === action ? '' : action); setPage(0); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACTION_COLORS[action] || 'var(--gray)' }} />
            {action}
            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{(actionCounts.get(action) || 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="filter-input"
          placeholder="🔍 Search employee or topic..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          style={{ maxWidth: 300 }}
        />
        <select className="filter-select" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(0); }}>
          <option value="">All Sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || actionFilter || sourceFilter) && (
          <button className="filter-btn active-filters" onClick={clearFilters}>
            ✕ Clear Filters
          </button>
        )}
      </div>

      {/* Log table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 130 }}>DateTime</th>
                <th>Employee</th>
                <th>Supervisor</th>
                <th>Topic</th>
                <th>Action</th>
                <th>Source</th>
                <th>Score</th>
                <th style={{ minWidth: 200 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((entry, i) => (
                <tr key={`${entry.empKey}-${entry.action}-${i}`}>
                  <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {entry.dateTimeStr}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {entry.employeeName}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>{entry.empKey}</span>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{entry.supervisor.split('@')[0]}</td>
                  <td style={{ fontSize: '0.82rem' }}>{entry.topic}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                      background: `${ACTION_COLORS[entry.action] || 'var(--gray)'}18`,
                      color: ACTION_COLORS[entry.action] || 'var(--gray)',
                    }}>
                      {entry.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{entry.source}</td>
                  <td style={{
                    fontWeight: entry.score === 'Correct' ? 600 : 400,
                    color: entry.score === 'Correct' ? 'var(--green)' : entry.score === 'Incorrect' ? 'var(--red)' : 'var(--text-muted)',
                  }}>{entry.score}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(0)} style={{ padding: '3px 10px' }}>⏮</button>
            <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '3px 10px' }}>← Prev</button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '4px 8px' }}>
              {page + 1} / {totalPages}
            </span>
            <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '3px 10px' }}>Next →</button>
            <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} style={{ padding: '3px 10px' }}>⏭</button>
          </div>
        </div>
      </div>
    </div>
  );
}
