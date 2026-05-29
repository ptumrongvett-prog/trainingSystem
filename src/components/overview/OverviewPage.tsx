import { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend,
} from 'chart.js';
import { useDataStore } from '../../hooks/useDataStore';
import { getTopicName } from '../../lib/topicMap';
import KpiCards from './KpiCards';
import LoadingSkeleton from '../shared/LoadingSkeleton';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export default function OverviewPage() {
  const { analytics, alerts, insights, loading, meta } = useDataStore();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id)).slice(0, 3);

  const topicChartData = useMemo(() => {
    const overdueTopics = analytics.topicBreakdown.filter(t => t.overdue > 0);
    return {
      labels: overdueTopics.map(t => getTopicName(t.topicId)),
      datasets: [
        { label: 'Completed', data: overdueTopics.map(t => t.completed), backgroundColor: '#00d4aa' },
        { label: 'Pending',   data: overdueTopics.map(t => t.pending),   backgroundColor: '#3b82f6' },
        { label: 'Overdue',   data: overdueTopics.map(t => t.overdue),   backgroundColor: '#ef4444' },
      ],
    };
  }, [analytics.topicBreakdown]);

  const deptChartData = useMemo(() => {
    const withOverdue = analytics.departmentBreakdown.filter(d => d.overdue > 0).slice(0, 10);
    const palette = [
      '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
      '#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9',
    ];
    return {
      labels: withOverdue.map(d => d.department),
      datasets: [{
        data: withOverdue.map(d => d.overdue),
        backgroundColor: withOverdue.map((_, i) => palette[i % palette.length]),
        borderWidth: 0,
      }],
    };
  }, [analytics.departmentBreakdown]);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e2a4a' } },
      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e2a4a' } },
    },
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const, labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 12 } },
    },
  };

  if (loading) return <LoadingSkeleton type="cards" />;

  return (
    <div>
      <div className="page-header">
        <h1>Training Compliance Overview</h1>
        <div className="actions">
          {meta.source === 'sample' && (
            <span style={{ fontSize: '0.75rem', color: 'var(--amber)', background: 'rgba(245,158,11,0.1)', padding: '4px 10px', borderRadius: 20 }}>
              ⚠ Sample Data
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {analytics.totalEmployees} employees · {analytics.totalTopics} topics
          </span>
        </div>
      </div>

      {/* Alerts */}
      {visibleAlerts.map(alert => (
        <div key={alert.id} className={`alert-banner ${alert.severity}`}>
          <span>{alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟠' : '🔵'}</span>
          <div>
            <strong>{alert.title}</strong>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: 2 }}>{alert.message}</div>
          </div>
          <button className="dismiss" onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.id]))}>✕</button>
        </div>
      ))}

      {/* KPIs */}
      <KpiCards />

      {/* Charts */}
      <div className="charts-row">
        <div className="chart-card">
          <h3>📈 Overdue Topics Only</h3>
          <div style={{ height: 300 }}>
            <Bar data={topicChartData} options={chartOpts} />
          </div>
        </div>
        <div className="chart-card">
          <h3>🏭 Overdue by Department</h3>
          <div style={{ height: 300 }}>
            <Doughnut data={deptChartData} options={doughnutOpts} />
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: 16, color: 'var(--text-secondary)' }}>
            💡 Insights <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>Powered by Rules</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {insights.slice(0, 4).map(insight => (
              <div key={insight.id} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: 14,
                borderLeft: `3px solid ${insight.severity === 'critical' ? 'var(--red)' : insight.severity === 'warning' ? 'var(--amber)' : 'var(--blue)'}`,
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>{insight.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{insight.description}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontStyle: 'italic' }}>→ {insight.suggestedAction}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Summary */}
      <div className="card">
        <h3 style={{ fontSize: '0.9rem', marginBottom: 12, color: 'var(--text-secondary)' }}>📋 Division Summary</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Division</th>
              <th>Completed</th>
              <th>Total</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {analytics.divisionBreakdown.map(d => (
              <tr key={d.division}>
                <td style={{ fontWeight: 600 }}>{d.division}</td>
                <td>{d.completed}</td>
                <td>{d.total}</td>
                <td>
                  <span style={{ color: d.rate >= 0.8 ? 'var(--green)' : d.rate >= 0.5 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>
                    {(d.rate * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
