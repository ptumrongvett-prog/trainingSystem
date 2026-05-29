import { useState, useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { generateCenterAlerts } from '../../lib/alertsCenter';
import type { Alert, AlertSeverity } from '../../types';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

type Tab = 'all' | 'critical' | 'warning' | 'info';

const TAB_CONFIG: Record<Tab, { label: string; icon: string; color: string }> = {
  all:      { label: 'All',      icon: '📋', color: 'var(--text-secondary)' },
  critical: { label: 'Critical', icon: '🔴', color: 'var(--red)' },
  warning:  { label: 'Warning',  icon: '🟠', color: 'var(--amber)' },
  info:     { label: 'Info',     icon: '🔵', color: 'var(--blue)' },
};

export default function AlertsCenter() {
  const { filteredData } = useDataStore();
  const [tab, setTab] = useState<Tab>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const allAlerts = useMemo(
    () => generateCenterAlerts(filteredData.assignments, filteredData.employees, filteredData.quizResponses),
    [filteredData]
  );

  const counts = useMemo(() => ({
    all: allAlerts.length,
    critical: allAlerts.filter(a => a.severity === 'critical').length,
    warning: allAlerts.filter(a => a.severity === 'warning').length,
    info: allAlerts.filter(a => a.severity === 'info').length,
  }), [allAlerts]);

  const filtered = useMemo(() => {
    let list = allAlerts;
    if (tab !== 'all') list = list.filter(a => a.severity === tab);
    return list.filter(a => !dismissed.has(a.id));
  }, [allAlerts, tab, dismissed]);

  const dismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));
  const dismissAll = () => setDismissed(new Set(allAlerts.map(a => a.id)));
  const resetDismissed = () => setDismissed(new Set());

  const exportData = filtered.map(a => ({
    Severity: a.severity, Type: a.type, Title: a.title,
    Message: a.message, Affected: a.affectedCount,
    Department: a.department || '—', Topic: a.topicId || '—',
  }));

  if (allAlerts.length === 0) {
    return <EmptyState icon="🔔" title="No Alerts" message="All clear — no compliance issues detected." />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Smart Alerts Center</h1>
        <div className="actions">
          {dismissed.size > 0 && (
            <button className="btn btn-secondary" onClick={resetDismissed} style={{ fontSize: '0.8rem' }}>
              🔄 Reset ({dismissed.size})
            </button>
          )}
          <button className="btn btn-secondary" onClick={dismissAll} style={{ fontSize: '0.8rem' }}>✓ Dismiss All</button>
          <ExportButton data={exportData} filename="alerts_report" label="Export" />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(Object.keys(TAB_CONFIG) as Tab[]).map(t => {
          const cfg = TAB_CONFIG[t];
          const count = counts[t];
          const isActive = tab === t;
          return (
            <button
              key={t}
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : count > 0 ? `${cfg.color}20` : 'transparent',
                color: isActive ? 'inherit' : cfg.color,
                padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alert cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(alert => (
          <AlertCard key={alert.id} alert={alert} onDismiss={() => dismiss(alert.id)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            {dismissed.size > 0 ? '✅ All alerts dismissed for this session' : 'No alerts in this category'}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const severityStyle = {
    critical: { border: 'var(--red)', bg: 'rgba(239,68,68,0.06)', icon: '🔴', badge: 'rgba(239,68,68,0.15)' },
    warning:  { border: 'var(--amber)', bg: 'rgba(245,158,11,0.06)', icon: '🟠', badge: 'rgba(245,158,11,0.15)' },
    info:     { border: 'var(--blue)', bg: 'rgba(59,130,246,0.06)', icon: '🔵', badge: 'rgba(59,130,246,0.15)' },
  }[alert.severity];

  return (
    <div style={{
      background: severityStyle.bg,
      border: `1px solid ${severityStyle.border}30`,
      borderLeft: `4px solid ${severityStyle.border}`,
      borderRadius: 'var(--radius-sm)',
      padding: '14px 18px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: '1.2rem', marginTop: 2 }}>{severityStyle.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alert.title}</span>
          <span style={{
            fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px',
            borderRadius: 10, background: severityStyle.badge, color: severityStyle.border,
            textTransform: 'uppercase',
          }}>
            {alert.severity}
          </span>
          {(alert.affectedCount ?? 0) > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {alert.affectedCount} affected
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{alert.message}</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {alert.department && <span>🏭 {alert.department}</span>}
          {alert.topicId && <span>📖 {alert.topicId}</span>}
        </div>
      </div>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        cursor: 'pointer', fontSize: '1rem', padding: 4, opacity: 0.6,
      }} title="Dismiss">✕</button>
    </div>
  );
}
