import { useEffect, useMemo, useState } from 'react';
import {
  aggregatePartTraining,
  formatTrainingDate,
  normalizeEmployeeId,
  type EmployeePartSummary,
  type PartTrainingPair,
  type PartTrainingReport,
} from '../../lib/partTraining';
import { loadPartTrainingSource } from '../../services/partTrainingSheets';
import EmptyState from '../shared/EmptyState';
import ExportButton from '../shared/ExportButton';

interface Props {
  onOpenProfile?: (empId: string) => void;
}

function employeeMatches(employee: EmployeePartSummary, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if (employee.empId.toLowerCase().includes(text)) return true;
  if (employee.employeeName.toLowerCase().includes(text)) return true;
  const asId = normalizeEmployeeId(query);
  return asId != null && employee.empId === asId;
}

function partMatches(partNumber: string, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return partNumber.toLowerCase().includes(text);
}

export default function PartTrainingPage({ onOpenProfile }: Props) {
  const [report, setReport] = useState<PartTrainingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('Reading the FN-112 training log…');
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const reload = () => {
    setLoading(true);
    setError(null);
    setReport(null);
    setProgress('Reading the FN-112 training log…');
    setReloadToken(token => token + 1);
  };

  useEffect(() => {
    let cancelled = false;

    loadPartTrainingSource({
      force: reloadToken > 0,
      onProgress: loaded => {
        if (!cancelled) {
          setProgress(`Reading the FN-112 training log… ${loaded.toLocaleString()} rows`);
        }
      },
    }).then(source => {
      if (cancelled) return;
      setReport(aggregatePartTraining(source.rows, source.activeEmployees, new Date()));
      setLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : 'Could not load part training.';
      setError(message);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const filteredEmployees = useMemo(() => {
    if (!report) return [];
    return report.employees.flatMap(employee => {
      if (!employeeMatches(employee, search)) return [];
      const parts = employee.parts.filter(part => partMatches(part.partNumber, partFilter));
      if (parts.length === 0) return [];
      if (parts.length === employee.parts.length) return [employee];
      return [{
        ...employee,
        parts,
        partCount: parts.length,
        entryCount: parts.reduce((sum, part) => sum + part.entryCount, 0),
        firstDate: parts.reduce((min, part) => part.firstDate < min ? part.firstDate : min, parts[0].firstDate),
        latestDate: parts.reduce((max, part) => part.latestDate > max ? part.latestDate : max, parts[0].latestDate),
      }];
    });
  }, [report, search, partFilter]);

  const filteredPairs = useMemo(
    () => filteredEmployees.flatMap(employee => employee.parts),
    [filteredEmployees],
  );

  const exportRows = useMemo(() => filteredPairs.map(toExportRow), [filteredPairs]);

  const toggle = (empId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Part Training</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '1.6rem', marginBottom: 10 }}>⏳</div>
          <div style={{ fontWeight: 600 }}>{progress}</div>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            The log has about 76,000 rows. They are totaled in the browser, one row per employee and part.
          </p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <div className="page-header">
          <h1>Part Training</h1>
        </div>
        <EmptyState
          icon="⚠️"
          title="Could not load part training"
          message={error || 'The training log did not load.'}
          actionLabel="Try again"
          onAction={reload}
        />
      </div>
    );
  }

  const filtersActive = search.trim() !== '' || partFilter.trim() !== '';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Part Training</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
            {report.employees.length.toLocaleString()} employees · {report.pairs.length.toLocaleString()} part pairs
            {' '}from {report.countedRows.toLocaleString()} dated log rows
            {report.skippedRows > 0 && ` · ${report.skippedRows.toLocaleString()} rows skipped (blank id/part or invalid date)`}
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={reload}>
            Refresh
          </button>
          <ExportButton data={exportRows} filename="part_training" label="Export CSV" />
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">{filtersActive ? 'Matching employees' : 'Employees'}</div>
          <div className="kpi-value blue">{filteredEmployees.length.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{filtersActive ? 'Matching pairs' : 'Part pairs'}</div>
          <div className="kpi-value">{filteredPairs.length.toLocaleString()}</div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-label">Active in directory</div>
          <div className="kpi-value green">{filteredEmployees.filter(employee => employee.active).length.toLocaleString()}</div>
          <div className="kpi-sub">On the Employee tab</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Not active</div>
          <div className="kpi-value amber">{filteredEmployees.filter(employee => !employee.active).length.toLocaleString()}</div>
          <div className="kpi-sub">Name kept from the log</div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="🔍 Employee ID or name"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Search by employee ID or name"
          style={{ flex: 1, minWidth: 220 }}
        />
        <input
          className="filter-input"
          placeholder="Part number"
          value={partFilter}
          onChange={event => setPartFilter(event.target.value)}
          aria-label="Filter by part number"
          style={{ flex: 1, minWidth: 180 }}
        />
        {filtersActive && (
          <button className="filter-btn" onClick={() => { setSearch(''); setPartFilter(''); }}>
            Clear
          </button>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 'auto' }}>
          {filteredPairs.length.toLocaleString()} pairs · {filteredEmployees.length.toLocaleString()} employees
        </span>
      </div>

      {filteredEmployees.length === 0 ? (
        <EmptyState
          icon="🔩"
          title="No matches"
          message="No employees have a part training row for that search. Try a partial ID, name, or part number."
        />
      ) : (
        <div className="card" style={{ padding: 0, maxHeight: 'calc(100vh - 340px)', overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Emp ID</th>
                <th>Employee</th>
                <th>Active</th>
                <th>Parts</th>
                <th>Entries</th>
                <th>First training</th>
                <th>Latest training</th>
                {onOpenProfile && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <EmployeeRows
                  key={employee.empId}
                  employee={employee}
                  expanded={expanded.has(employee.empId)}
                  onToggle={() => toggle(employee.empId)}
                  onOpenProfile={onOpenProfile}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 12 }}>
        Read-only. Source is the FN-112_Training Log tab; active names come from the Employee tab.
        Open a row to see each part.
      </p>
    </div>
  );
}

function toExportRow(pair: PartTrainingPair): Record<string, string | number> {
  return {
    'Emp ID': pair.empId,
    'Employee Name': pair.employeeName,
    Active: pair.active ? 'Yes' : 'No',
    'Part #': pair.partNumber,
    '# Training Entries': pair.entryCount,
    'First Training Date': formatTrainingDate(pair.firstDate),
    'Latest Training Date': formatTrainingDate(pair.latestDate),
  };
}

function EmployeeRows({
  employee, expanded, onToggle, onOpenProfile,
}: {
  employee: EmployeePartSummary;
  expanded: boolean;
  onToggle: () => void;
  onOpenProfile?: (empId: string) => void;
}) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ textAlign: 'center' }}>{expanded ? '▼' : '▶'}</td>
        <td style={{ fontWeight: 600 }}>{employee.empId}</td>
        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{employee.employeeName || '—'}</td>
        <td>
          <span className={`status-badge ${employee.active ? 'completed' : 'inactive'}`}>
            {employee.active ? 'Yes' : 'No'}
          </span>
        </td>
        <td>{employee.partCount.toLocaleString()}</td>
        <td>{employee.entryCount.toLocaleString()}</td>
        <td>{formatTrainingDate(employee.firstDate)}</td>
        <td>{formatTrainingDate(employee.latestDate)}</td>
        {onOpenProfile && (
          <td>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={event => {
                event.stopPropagation();
                onOpenProfile(employee.empId);
              }}
            >
              Profile
            </button>
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={onOpenProfile ? 9 : 8} style={{ padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '12px 24px 16px', maxHeight: 360, overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Part #</th>
                    <th>Training entries</th>
                    <th>First training</th>
                    <th>Latest training</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.parts.map(part => (
                    <tr key={part.partNumber}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{part.partNumber}</td>
                      <td>{part.entryCount.toLocaleString()}</td>
                      <td>{formatTrainingDate(part.firstDate)}</td>
                      <td>{formatTrainingDate(part.latestDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
