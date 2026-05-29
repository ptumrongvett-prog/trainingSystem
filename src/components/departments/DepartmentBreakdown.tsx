import { useState, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useDataStore } from '../../hooks/useDataStore';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#00d4aa', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6', '#f43f5e', '#a855f7', '#22c55e', '#e11d48', '#0ea5e9', '#eab308'];

export default function DepartmentBreakdown() {
  const { analytics, filteredData } = useDataStore();
  const [shiftFilter, setShiftFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'charts' | 'table'>('charts');

  // Recompute with shift filter applied
  const deptData = useMemo(() => {
    if (!shiftFilter) return analytics.departmentBreakdown;

    // Filter employees by shift, then recalculate
    const filteredEmps = new Set(
      filteredData.employees.filter(e => e.shift === shiftFilter).map(e => e.EmpKey)
    );
    const filteredAssigns = filteredData.assignments.filter(a => filteredEmps.has(a.EmpKey));

    const deptStats = new Map<string, { completed: number; total: number; overdue: number }>();
    const empMap = new Map(filteredData.employees.map(e => [e.EmpKey, e]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const a of filteredAssigns) {
      const emp = empMap.get(a.EmpKey);
      const dept = emp?.department || 'Unknown';
      const stat = deptStats.get(dept) || { completed: 0, total: 0, overdue: 0 };
      stat.total++;
      if ((a.Status || '').toLowerCase() === 'completed') {
        stat.completed++;
      } else {
        const due = new Date(a.DueDate);
        if (!isNaN(due.getTime()) && due < today) stat.overdue++;
      }
      deptStats.set(dept, stat);
    }

    return Array.from(deptStats.entries())
      .filter(([department]) => department !== 'Unknown')
      .map(([department, stat]) => ({
        department, completed: stat.completed, total: stat.total,
        rate: stat.total > 0 ? stat.completed / stat.total : 0, overdue: stat.overdue,
      }))
      .sort((a, b) => b.overdue - a.overdue);
  }, [analytics.departmentBreakdown, shiftFilter, filteredData]);

  const divisionData = useMemo(() => {
    if (!shiftFilter) return analytics.divisionBreakdown;
    const filteredEmps = new Set(
      filteredData.employees.filter(e => e.shift === shiftFilter).map(e => e.EmpKey)
    );
    const filteredAssigns = filteredData.assignments.filter(a => filteredEmps.has(a.EmpKey));
    const divStats = new Map<string, { completed: number; total: number }>();
    const empMap = new Map(filteredData.employees.map(e => [e.EmpKey, e]));
    for (const a of filteredAssigns) {
      const emp = empMap.get(a.EmpKey);
      const div = emp?.division || 'Unknown';
      const stat = divStats.get(div) || { completed: 0, total: 0 };
      stat.total++;
      if ((a.Status || '').toLowerCase() === 'completed') stat.completed++;
      divStats.set(div, stat);
    }
    return Array.from(divStats.entries()).map(([division, stat]) => ({
      division, completed: stat.completed, total: stat.total,
      rate: stat.total > 0 ? stat.completed / stat.total : 0,
    }));
  }, [analytics.divisionBreakdown, shiftFilter, filteredData]);

  const shifts = useMemo(() => [...new Set(filteredData.employees.map(e => e.shift).filter(Boolean))].sort(), [filteredData.employees]);

  const exportData = deptData.map(d => ({
    Department: d.department, Completed: d.completed, Total: d.total,
    Rate: `${(d.rate * 100).toFixed(1)}%`, Overdue: d.overdue,
  }));

  const doughnutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    cutout: '65%',
  };

  if (deptData.length === 0) {
    return <EmptyState icon="🏭" title="No Department Data" message="No department data found with current filters." />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Department Breakdown</h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4, maxWidth: 600 }}>
            Shows the on-track % for each department — higher is better. The red portion indicates overdue training assignments past their due date.
          </p>
        </div>
        <div className="actions">
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`btn ${shiftFilter === '' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShiftFilter('')} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>All Shifts</button>
            {shifts.map(s => (
              <button key={s} className={`btn ${shiftFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShiftFilter(s)} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>{s}</button>
            ))}
          </div>
          <button className={`btn ${viewMode === 'charts' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode(v => v === 'charts' ? 'table' : 'charts')} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
            {viewMode === 'charts' ? '📊 Charts' : '📋 Table'}
          </button>
          <ExportButton data={exportData} filename="department_breakdown" />
        </div>
      </div>

      {/* Division overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {divisionData.map(d => (
          <div key={d.division} className="kpi-card" style={{ cursor: 'default' }}>
            <div className="kpi-label">{d.division} Division</div>
            <div className={`kpi-value ${d.rate >= 0.8 ? 'green' : d.rate >= 0.5 ? 'amber' : 'red'}`}>
              {(d.rate * 100).toFixed(1)}%
            </div>
            <div className="kpi-sub">{d.completed} / {d.total} completed</div>
          </div>
        ))}
      </div>

      {viewMode === 'charts' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {deptData.map((d, i) => {
            const safeOverdue = d.overdue || 0;
            const safeTotal = d.total || 1;
            const onTrack = safeTotal - safeOverdue;
            const onTrackPercent = safeTotal > 0 ? (onTrack / safeTotal * 100) : 100;
            return (
            <div key={d.department} className="chart-card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ height: 150, position: 'relative' }}>
                <Doughnut
                  data={{
                    labels: ['On Track', 'Overdue'],
                    datasets: [{ data: [onTrack, safeOverdue], backgroundColor: ['#00d4aa', safeOverdue > 0 ? '#ef4444' : 'rgba(255,255,255,0.05)'], borderWidth: 0 }],
                  }}
                  options={doughnutOpts}
                />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.4rem', fontWeight: 700, color: onTrackPercent >= 90 ? 'var(--green)' : onTrackPercent >= 70 ? 'var(--amber)' : 'var(--red)' }}>
                  {onTrackPercent.toFixed(0)}%
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.85rem', fontWeight: 600 }}>{d.department}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{safeOverdue} overdue / {d.total} total</div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead><tr><th>Department</th><th>Completed</th><th>Total</th><th>Rate</th><th>Overdue</th><th>Status</th></tr></thead>
            <tbody>
              {deptData.map(d => (
                <tr key={d.department}>
                  <td style={{ fontWeight: 600 }}>{d.department}</td>
                  <td>{d.completed}</td>
                  <td>{d.total}</td>
                  <td><span style={{ color: d.rate >= 0.8 ? 'var(--green)' : d.rate >= 0.5 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>{(d.rate * 100).toFixed(1)}%</span></td>
                  <td style={{ color: d.overdue > 0 ? 'var(--red)' : 'inherit' }}>{d.overdue}</td>
                  <td>
                    <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${d.rate * 100}%`, height: '100%', background: d.rate >= 0.8 ? 'var(--green)' : d.rate >= 0.5 ? 'var(--amber)' : 'var(--red)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
