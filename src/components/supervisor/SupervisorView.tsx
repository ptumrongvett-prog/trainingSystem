import { useState, useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { buildSupervisorFollowUp } from '../../lib/supervisorHelpers';
import type { SupervisorRow } from '../../lib/supervisorHelpers';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

export default function SupervisorView() {
  const { filteredData } = useDataStore();
  const [expandedSup, setExpandedSup] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const allRows = useMemo(
    () => buildSupervisorFollowUp(filteredData.employees, filteredData.assignments),
    [filteredData.employees, filteredData.assignments]
  );

  const rows = useMemo(() => {
    if (!search) return allRows;
    const s = search.toLowerCase();
    return allRows.filter(r => r.supervisor.toLowerCase().includes(s));
  }, [allRows, search]);

  const totalOverdue = rows.reduce((s, r) => s + r.overdueCount, 0);
  const totalDueSoon = rows.reduce((s, r) => s + r.dueSoon7, 0);
  const criticalSups = rows.filter(r => r.overdueCount > 0).length;

  const summaryExport = rows.map(r => ({
    Supervisor: r.supervisor, Employees: r.employeeCount,
    Overdue: r.overdueCount, DueSoon7Days: r.dueSoon7,
    Missing: r.missingCount, CompletionRate: `${(r.completionRate * 100).toFixed(1)}%`,
  }));

  const toggle = (sup: string) => setExpandedSup(prev => prev === sup ? null : sup);

  if (allRows.length === 0) {
    return <EmptyState icon="👔" title="No Supervisors" message="No supervisor data in current filters." />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Supervisor Follow-Up</h1>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => window.print()} style={{ fontSize: '0.8rem' }}>🖨️ Print</button>
          <ExportButton data={summaryExport} filename="supervisor_followup" label="Export All" />
        </div>
      </div>

      {/* Summary */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card"><div className="kpi-label">Supervisors</div><div className="kpi-value blue">{rows.length}</div></div>
        <div className={`kpi-card ${totalOverdue > 0 ? 'critical' : 'success'}`}><div className="kpi-label">Total Overdue</div><div className={`kpi-value ${totalOverdue > 0 ? 'red' : 'green'}`}>{totalOverdue}</div></div>
        <div className={`kpi-card ${totalDueSoon > 0 ? 'warning' : 'success'}`}><div className="kpi-label">Due Within 7 Days</div><div className={`kpi-value ${totalDueSoon > 0 ? 'amber' : 'green'}`}>{totalDueSoon}</div></div>
        <div className={`kpi-card ${criticalSups > 0 ? 'critical' : 'success'}`}><div className="kpi-label">Sups With Overdue</div><div className={`kpi-value ${criticalSups > 0 ? 'red' : 'green'}`}>{criticalSups}</div></div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="filter-input"
          placeholder="🔍 Search supervisor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 400 }}
        />
      </div>

      {/* Supervisor Table */}
      <div className="card print-section" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Supervisor</th>
              <th>Employees</th>
              <th>Completion</th>
              <th>Overdue</th>
              <th>Due 7 Days</th>
              <th>Missing</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <SupervisorRowComponent
                key={row.supervisor}
                row={row}
                isExpanded={expandedSup === row.supervisor}
                onToggle={() => toggle(row.supervisor)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Supervisor Row with Expandable Detail ─── */

function SupervisorRowComponent({
  row, isExpanded, onToggle,
}: { row: SupervisorRow; isExpanded: boolean; onToggle: () => void }) {

  const detailExport = row.employees.map(e => ({
    Name: e.name, EmpKey: e.empKey, Department: e.department,
    Division: e.division, Shift: e.shift, Assigned: e.totalAssigned,
    Completed: e.completed, Overdue: e.overdue, DueSoon: e.dueSoon,
    NextDue: e.nextDue, Status: e.status,
  }));

  const rateColor = row.completionRate >= 0.8 ? 'var(--green)' : row.completionRate >= 0.5 ? 'var(--amber)' : 'var(--red)';

  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td style={{ textAlign: 'center', fontSize: '0.9rem' }}>{isExpanded ? '▼' : '▶'}</td>
        <td style={{ fontWeight: 600 }}>
          {row.supervisor.split('@')[0]}
          {row.overdueCount > 0 && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--red)', fontWeight: 700 }}>⚠ ACTION NEEDED</span>}
        </td>
        <td>{row.employeeCount}</td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${row.completionRate * 100}%`, height: '100%', background: rateColor, borderRadius: 3 }} />
            </div>
            <span style={{ color: rateColor, fontWeight: 600, fontSize: '0.85rem' }}>{(row.completionRate * 100).toFixed(1)}%</span>
          </div>
        </td>
        <td style={{ color: row.overdueCount > 0 ? 'var(--red)' : 'inherit', fontWeight: row.overdueCount > 0 ? 700 : 400 }}>{row.overdueCount}</td>
        <td style={{ color: row.dueSoon7 > 0 ? 'var(--amber)' : 'inherit', fontWeight: row.dueSoon7 > 0 ? 700 : 400 }}>{row.dueSoon7}</td>
        <td>{row.missingCount}</td>
        <td>
          <ExportButton data={detailExport} filename={`supervisor_${row.supervisor.split('@')[0]}`} label="CSV" />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} style={{ padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '12px 24px 16px', maxHeight: 400, overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Employee</th>
                    <th>Dept</th>
                    <th>Div</th>
                    <th>Shift</th>
                    <th>Assigned</th>
                    <th>Completed</th>
                    <th>Overdue</th>
                    <th>Due Soon</th>
                    <th>Next Due</th>
                  </tr>
                </thead>
                <tbody>
                  {row.employees.map(emp => (
                    <tr key={emp.empKey}>
                      <td>
                        <span style={{
                          display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                          background: emp.status === 'critical' ? 'var(--red)' : emp.status === 'warning' ? 'var(--amber)' : 'var(--green)',
                          boxShadow: emp.status === 'critical' ? '0 0 6px var(--red)' : 'none',
                        }} />
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {emp.name}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>{emp.empKey}</span>
                      </td>
                      <td>{emp.department}</td>
                      <td>{emp.division}</td>
                      <td>{emp.shift}</td>
                      <td>{emp.totalAssigned}</td>
                      <td style={{ color: 'var(--green)' }}>{emp.completed}</td>
                      <td style={{ color: emp.overdue > 0 ? 'var(--red)' : 'inherit', fontWeight: emp.overdue > 0 ? 700 : 400 }}>{emp.overdue}</td>
                      <td style={{ color: emp.dueSoon > 0 ? 'var(--amber)' : 'inherit' }}>{emp.dueSoon}</td>
                      <td style={{ fontSize: '0.78rem' }}>{emp.nextDue}</td>
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
