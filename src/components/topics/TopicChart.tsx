import { useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useDataStore } from '../../hooks/useDataStore';
import { getTopicName, isTopicNameMissing } from '../../lib/topicMap';
import { resolveAssignmentStatus } from '../../lib/statusRules';
import { ComplianceStatus } from '../../types';
import StatusBadge from '../shared/StatusBadge';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function TopicChart() {
  const { analytics, filteredData, data } = useDataStore();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'rate' | 'overdue' | 'name'>('rate');
  const [drillSearch, setDrillSearch] = useState('');

  const sorted = useMemo(() => {
    const items = [...analytics.topicBreakdown];
    if (sortBy === 'rate') items.sort((a, b) => a.rate - b.rate);
    else if (sortBy === 'overdue') items.sort((a, b) => b.overdue - a.overdue);
    else items.sort((a, b) => a.topicId.localeCompare(b.topicId));
    return items;
  }, [analytics.topicBreakdown, sortBy]);

  const chartData = useMemo(() => ({
    labels: sorted.map(t => `${t.topicId} - ${getTopicName(t.topicId)}`),
    datasets: [
      { label: 'Completed', data: sorted.map(t => t.completed), backgroundColor: '#00d4aa' },
      { label: 'Pending', data: sorted.map(t => t.pending), backgroundColor: '#3b82f6' },
      { label: 'Overdue', data: sorted.map(t => t.overdue), backgroundColor: '#ef4444' },
    ],
  }), [sorted]);

  // Drill-down: employees for selected topic
  const drillDown = useMemo(() => {
    if (!selectedTopic) return [];
    const empMap = new Map(filteredData.employees.map(e => [e.EmpKey, e]));
    const topicAssignments = filteredData.assignments.filter(a => a.TopicID === selectedTopic);

    return topicAssignments.map(a => {
      const emp = empMap.get(a.EmpKey);
      const status = resolveAssignmentStatus(a, emp || null);
      return {
        EmpKey: a.EmpKey,
        Name: emp ? `${emp.first_name} ${emp.last_name}` : a.EmpKey,
        Department: emp?.department || '—',
        Division: emp?.division || '—',
        Shift: emp?.shift || '—',
        Status: status,
        DateAssigned: a.DateAssigned || '—',
        DueDate: a.DueDate || '—',
      };
    }).sort((a, b) => {
      if (a.Status === ComplianceStatus.OVERDUE && b.Status !== ComplianceStatus.OVERDUE) return -1;
      if (b.Status === ComplianceStatus.OVERDUE && a.Status !== ComplianceStatus.OVERDUE) return 1;
      return a.Name.localeCompare(b.Name);
    });
  }, [selectedTopic, filteredData]);

  // Search within drill-down
  const filteredDrillDown = useMemo(() => {
    if (!drillSearch) return drillDown;
    const s = drillSearch.toLowerCase();
    return drillDown.filter(d =>
      d.Name.toLowerCase().includes(s) ||
      d.EmpKey.toLowerCase().includes(s) ||
      d.Department.toLowerCase().includes(s) ||
      d.Shift.toLowerCase().includes(s) ||
      (d.Status as string).toLowerCase().includes(s)
    );
  }, [drillDown, drillSearch]);

  const exportData = filteredDrillDown.map(d => ({ ...d, Status: d.Status as string }));

  const chartOpts = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_: unknown, elements: { index: number }[]) => {
      if (elements.length > 0) setSelectedTopic(sorted[elements[0].index].topicId);
    },
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
      tooltip: { callbacks: { title: (ctx: { label: string }[]) => {
        const t = sorted.find(s => s.topicId === ctx[0]?.label);
        return t ? `${t.topicId}${isTopicNameMissing(t.topicId) ? ' ⚠ Name missing' : ''}` : '';
      }}},
    },
    scales: {
      x: { stacked: true, ticks: { color: '#64748b' }, grid: { color: '#1e2a4a' } },
      y: { stacked: true, ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
    },
  };

  if (analytics.topicBreakdown.length === 0) {
    return <EmptyState icon="📈" title="No Topic Data" message="No training topics found in the current filtered data." />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Topic Analysis</h1>
        <div className="actions">
          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <option value="rate">Sort: Completion Rate</option>
            <option value="overdue">Sort: Most Overdue</option>
            <option value="name">Sort: Topic ID</option>
          </select>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 20 }}>
        <h3>📊 Assigned vs Completed vs Overdue — Click a bar to drill down</h3>
        <div style={{ height: Math.max(200, sorted.length * 45) }}>
          <Bar data={chartData} options={chartOpts} />
        </div>
      </div>

      {/* Topic summary table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Topic Summary</h3>
        <table className="data-table">
          <thead><tr><th>Topic</th><th>Assigned</th><th>Completed</th><th>Pending</th><th>Overdue</th><th>Rate</th><th></th></tr></thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.topicId} style={{ cursor: 'pointer' }} onClick={() => setSelectedTopic(t.topicId)}>
                <td style={{ fontWeight: 600 }}>
                  {getTopicName(t.topicId)}
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>{t.topicId}</span>
                  {isTopicNameMissing(t.topicId) && <span style={{ fontSize: '0.7rem', color: 'var(--amber)', marginLeft: 6 }}>⚠ Name missing</span>}
                </td>
                <td>{t.assigned}</td>
                <td style={{ color: 'var(--green)' }}>{t.completed}</td>
                <td style={{ color: 'var(--blue)' }}>{t.pending}</td>
                <td style={{ color: t.overdue > 0 ? 'var(--red)' : 'inherit', fontWeight: t.overdue > 0 ? 700 : 400 }}>{t.overdue}</td>
                <td><span style={{ color: t.rate >= 0.8 ? 'var(--green)' : t.rate >= 0.5 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>{(t.rate * 100).toFixed(1)}%</span></td>
                <td><button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drill-down modal */}
      {selectedTopic && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              👥 Employees — {getTopicName(selectedTopic)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({selectedTopic})</span> ({filteredDrillDown.length}{drillSearch ? ` of ${drillDown.length}` : ''} assignments)
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <ExportButton data={exportData} filename={`topic_${selectedTopic}_employees`} label="Export" />
              <button className="btn btn-secondary" onClick={() => { setSelectedTopic(null); setDrillSearch(''); }} style={{ padding: '4px 12px' }}>✕ Close</button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="🔍 Search by name, EmpKey, department, shift..."
              value={drillSearch}
              onChange={e => setDrillSearch(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', fontSize: '0.85rem',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>EmpKey</th><th>Department</th><th>Division</th><th>Shift</th><th>Status</th><th>Assigned</th><th>Due</th></tr></thead>
              <tbody>
                {filteredDrillDown.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{d.Name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.EmpKey}</td>
                    <td>{d.Department}</td>
                    <td>{d.Division}</td>
                    <td>{d.Shift}</td>
                    <td><StatusBadge status={d.Status} /></td>
                    <td style={{ fontSize: '0.8rem' }}>{d.DateAssigned}</td>
                    <td style={{ fontSize: '0.8rem' }}>{d.DueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
