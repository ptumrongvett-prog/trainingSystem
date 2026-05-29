/**
 * ActionPlanPage.tsx — Supervisor action plans with prioritized to-do items.
 * Converts alerts into actionable follow-ups with email templates.
 * Additive only (Phase 5).
 */

import { useState, useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { buildActionPlans, generateEmailTemplate } from '../../lib/actionPlans';
import type { ActionPlan, ActionItem } from '../../lib/actionPlans';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

const PRIORITY_STYLES: Record<string, { color: string; icon: string; bg: string }> = {
  urgent: { color: 'var(--red)', icon: '🔴', bg: 'rgba(239,68,68,0.06)' },
  high:   { color: '#f97316', icon: '🟠', bg: 'rgba(249,115,22,0.06)' },
  medium: { color: 'var(--amber)', icon: '🟡', bg: 'rgba(245,158,11,0.06)' },
  low:    { color: 'var(--blue)', icon: '🔵', bg: 'rgba(59,130,246,0.06)' },
};

const TYPE_LABELS: Record<string, string> = {
  follow_up_overdue: 'Follow Up Overdue',
  send_reminder: 'Send Reminder',
  review_quiz: 'Review Quiz',
  assign_missing: 'Assign Training',
};

export default function ActionPlanPage() {
  const { filteredData } = useDataStore();
  const [selectedSup, setSelectedSup] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allPlans = useMemo(
    () => buildActionPlans(filteredData.employees, filteredData.assignments, filteredData.quizResponses),
    [filteredData],
  );

  const currentPlan = useMemo(() => {
    if (!selectedSup) return allPlans[0] || null;
    return allPlans.find(p => p.supervisor === selectedSup) || null;
  }, [allPlans, selectedSup]);

  const totalActions = allPlans.reduce((s, p) => s + p.totalActions, 0);
  const totalUrgent = allPlans.reduce((s, p) => s + p.urgentCount, 0);
  const totalMinutes = allPlans.reduce((s, p) => s + p.estimatedMinutes, 0);

  const handleCopyEmail = (action: ActionItem, supervisor: string) => {
    const text = generateEmailTemplate(action, supervisor);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(action.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCopyAll = () => {
    if (!currentPlan) return;
    const lines = currentPlan.actions.map((a, i) =>
      `${i + 1}. [${a.priority.toUpperCase()}] ${a.employeeName} — ${TYPE_LABELS[a.type]}\n   ${a.description}\n   Topic: ${a.topic}`
    );
    const header = `Action Plan for ${currentPlan.supervisor.split('@')[0]}\nGenerated: ${currentPlan.generatedAt.toLocaleDateString()}\nTotal: ${currentPlan.totalActions} actions (est. ${currentPlan.estimatedMinutes} min)\n${'─'.repeat(50)}\n\n`;
    navigator.clipboard.writeText(header + lines.join('\n\n'));
  };

  const exportData = currentPlan?.actions.map(a => ({
    Priority: a.priority, Type: TYPE_LABELS[a.type],
    Employee: a.employeeName, EmpKey: a.empKey,
    Topic: a.topic, Description: a.description,
    DaysPastDue: a.daysPastDue, EstMinutes: a.estimatedMinutes,
  })) || [];

  if (allPlans.length === 0) {
    return <EmptyState icon="✅" title="No Action Needed" message="All supervisors are clear — no follow-up items detected." />;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Supervisor Action Plans</h1>
        <div className="actions">
          <button className="btn btn-secondary" onClick={handleCopyAll} style={{ fontSize: '0.8rem' }}>📋 Copy All</button>
          <button className="btn btn-secondary" onClick={() => window.print()} style={{ fontSize: '0.8rem' }}>🖨️ Print</button>
          <ExportButton data={exportData} filename={`action_plan_${(currentPlan?.supervisor || 'all').split('@')[0]}`} label="Export" />
        </div>
      </div>

      {/* KPI Summary */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Actions</div>
          <div className="kpi-value blue">{totalActions}</div>
        </div>
        <div className={`kpi-card ${totalUrgent > 0 ? 'critical' : 'success'}`}>
          <div className="kpi-label">Urgent</div>
          <div className={`kpi-value ${totalUrgent > 0 ? 'red' : 'green'}`}>{totalUrgent}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Est. Total Time</div>
          <div className="kpi-value amber">{(totalMinutes / 60).toFixed(1)} hrs</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Supervisors</div>
          <div className="kpi-value green">{allPlans.length}</div>
        </div>
      </div>

      {/* Supervisor Selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Supervisor:</label>
        <select
          className="filter-select"
          value={selectedSup || allPlans[0]?.supervisor || ''}
          onChange={e => setSelectedSup(e.target.value)}
          style={{ minWidth: 250 }}
        >
          {allPlans.map(p => (
            <option key={p.supervisor} value={p.supervisor}>
              {p.supervisor.split('@')[0]} — {p.totalActions} actions ({p.urgentCount} urgent)
            </option>
          ))}
        </select>
        {currentPlan && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Est. {currentPlan.estimatedMinutes} min for {currentPlan.totalActions} actions
          </span>
        )}
      </div>

      {/* Action Cards */}
      {currentPlan && (
        <div className="print-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentPlan.actions.map(action => {
            const style = PRIORITY_STYLES[action.priority];
            return (
              <div key={action.id} style={{
                background: style.bg,
                border: `1px solid ${style.color}25`,
                borderLeft: `4px solid ${style.color}`,
                borderRadius: 'var(--radius-sm)',
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span>{style.icon}</span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                        borderRadius: 10, background: `${style.color}20`, color: style.color,
                        textTransform: 'uppercase',
                      }}>{action.priority}</span>
                      <span style={{
                        fontSize: '0.72rem', padding: '2px 8px',
                        borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-muted)',
                      }}>{TYPE_LABELS[action.type]}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>~{action.estimatedMinutes} min</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>
                      {action.employeeName}
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>{action.empKey}</span>
                      {action.topic !== '—' && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 8 }}>📖 {action.topic}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {action.description}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleCopyEmail(action, currentPlan.supervisor)}
                    style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', padding: '6px 12px' }}
                  >
                    {copiedId === action.id ? '✅ Copied!' : '📋 Copy Email'}
                  </button>
                </div>
              </div>
            );
          })}

          {currentPlan.actions.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              ✅ No actions needed for this supervisor
            </div>
          )}

          {/* Summary Footer */}
          <div style={{
            padding: '12px 18px', marginTop: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-secondary)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>📊 {currentPlan.totalActions} total actions</span>
            <span>🔴 {currentPlan.urgentCount} urgent</span>
            <span>⏱️ Est. {currentPlan.estimatedMinutes} min ({(currentPlan.estimatedMinutes / 60).toFixed(1)} hrs)</span>
            <span>📅 Generated {currentPlan.generatedAt.toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
