import { useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { computeExecutiveKpis } from '../../lib/executiveKpis';
import type { ExecutiveKpi, KpiStatus } from '../../lib/executiveKpis';
import ExportButton from '../shared/ExportButton';

const STATUS_CONFIG: Record<KpiStatus, { label: string; bg: string; color: string; icon: string }> = {
  green:  { label: 'Met',          bg: 'rgba(0,212,170,0.12)',  color: '#00d4aa', icon: '✅' },
  yellow: { label: 'At Risk',      bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', icon: '⚠️' },
  red:    { label: 'Below Target', bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', icon: '🔴' },
};

export default function ExecutiveKpiPage() {
  const { filteredData } = useDataStore();

  const kpis = useMemo(() =>
    computeExecutiveKpis(filteredData.employees, filteredData.assignments, filteredData.quizResponses),
    [filteredData]
  );

  const metCount = kpis.filter(k => k.status === 'green').length;
  const exportData = kpis.map(k => ({
    Metric: k.name, Category: k.category, Goal: `${k.goal}${k.unit === '%' ? '%' : ''}`,
    Actual: `${k.actual}${k.unit === '%' ? '%' : ''}`, Numerator: k.numerator,
    Denominator: k.denominator, Gap: k.gap, Trend: k.trendVsLastMonth ?? 'N/A',
    Status: STATUS_CONFIG[k.status].label, Formula: k.formula,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Executive Compliance KPIs</h1>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => window.print()} style={{ fontSize: '0.8rem' }}>
            🖨️ Print / PDF
          </button>
          <ExportButton data={exportData} filename="executive_kpi_report" label="Export CSV" />
        </div>
      </div>

      {/* Scorecard summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div className="kpi-card success" style={{ flex: 1, textAlign: 'center' }}>
          <div className="kpi-label">Targets Met</div>
          <div className={`kpi-value ${metCount === kpis.length ? 'green' : metCount >= 3 ? 'amber' : 'red'}`}>{metCount} / {kpis.length}</div>
        </div>
        {(['green', 'yellow', 'red'] as KpiStatus[]).map(s => {
          const count = kpis.filter(k => k.status === s).length;
          return (
            <div key={s} style={{ flex: 1, background: STATUS_CONFIG[s].bg, borderRadius: 'var(--radius)', padding: '16px 20px', textAlign: 'center', border: `1px solid ${STATUS_CONFIG[s].color}30` }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: STATUS_CONFIG[s].color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{STATUS_CONFIG[s].label}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: STATUS_CONFIG[s].color }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* KPI Cards - print-ready layout */}
      <div className="print-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {kpis.map(kpi => (
          <KpiRow key={kpi.id} kpi={kpi} />
        ))}
      </div>

      {/* Detail table */}
      <div className="card" style={{ marginTop: 24, padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Metric</th>
              <th>Goal</th>
              <th>Actual</th>
              <th>Numerator / Denominator</th>
              <th>Gap</th>
              <th>Trend vs Last Month</th>
              <th>Formula</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map(kpi => {
              const cfg = STATUS_CONFIG[kpi.status];
              return (
                <tr key={kpi.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{kpi.name}</td>
                  <td style={{ fontWeight: 600 }}>{kpi.goal}{kpi.unit === '%' ? '%' : ''}</td>
                  <td style={{ fontWeight: 700, color: cfg.color, fontSize: '1rem' }}>{kpi.actual}{kpi.unit === '%' ? '%' : ''}</td>
                  <td style={{ fontSize: '0.85rem' }}>{kpi.numerator.toLocaleString()} / {kpi.denominator.toLocaleString()}</td>
                  <td style={{ color: kpi.gap >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{kpi.gap > 0 ? '+' : ''}{kpi.gap}{kpi.unit === '%' ? 'pp' : ''}</td>
                  <td>
                    {kpi.trendVsLastMonth !== null ? (
                      <span style={{ color: kpi.trendVsLastMonth >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {kpi.trendVsLastMonth >= 0 ? '↑' : '↓'} {Math.abs(kpi.trendVsLastMonth)}{kpi.unit === '%' ? 'pp' : ''}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: 300, wordBreak: 'break-word' }}>{kpi.formula}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Individual KPI Row Card ─── */

function KpiRow({ kpi }: { kpi: ExecutiveKpi }) {
  const cfg = STATUS_CONFIG[kpi.status];
  const progressPct = kpi.unit === '%' ? Math.min(100, (kpi.actual / kpi.goal) * 100) : (kpi.denominator > 0 ? Math.min(100, ((kpi.denominator - kpi.actual) / kpi.denominator) * 100) : 0);

  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 180px 120px', gap: 20, alignItems: 'center', borderLeft: `4px solid ${cfg.color}` }}>
      {/* Status */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>{cfg.icon}</div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: cfg.color, textTransform: 'uppercase' }}>{cfg.label}</div>
      </div>

      {/* Details */}
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>{kpi.name}</div>
        <div style={{ display: 'flex', gap: 24, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          <span>🎯 Goal: <strong style={{ color: 'var(--text-primary)' }}>{kpi.goal}{kpi.unit === '%' ? '%' : ''}</strong></span>
          <span>📊 Actual: <strong style={{ color: cfg.color }}>{kpi.actual}{kpi.unit === '%' ? '%' : ''}</strong></span>
          <span>📐 {kpi.numerator.toLocaleString()} / {kpi.denominator.toLocaleString()}</span>
          <span style={{ color: kpi.gap >= 0 ? 'var(--green)' : 'var(--red)' }}>
            Gap: <strong>{kpi.gap > 0 ? '+' : ''}{kpi.gap}{kpi.unit === '%' ? 'pp' : ''}</strong>
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(progressPct, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`, borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>{kpi.formula}</div>
      </div>

      {/* Big number */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: cfg.color, lineHeight: 1 }}>
          {kpi.actual}{kpi.unit === '%' ? '%' : ''}
        </div>
      </div>

      {/* Trend */}
      <div style={{ textAlign: 'center' }}>
        {kpi.trendVsLastMonth !== null && (
          <>
            <div style={{ fontSize: '1.4rem', color: kpi.trendVsLastMonth >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
              {kpi.trendVsLastMonth >= 0 ? '↑' : '↓'} {Math.abs(kpi.trendVsLastMonth)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>vs last month</div>
          </>
        )}
      </div>
    </div>
  );
}
