import { useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { runFullAudit } from '../../lib/auditEngine';
import ExportButton from '../shared/ExportButton';

export default function AuditPage() {
  const { data, analytics } = useDataStore();

  const checks = useMemo(() => runFullAudit(data), [data]);

  const passed = checks.filter(c => c.pass).length;
  const failed = checks.filter(c => !c.pass).length;
  const total = checks.length;

  const exportData = checks.map(c => ({
    ID: c.id, Name: c.name, Formula: c.formula, RawSource: c.rawSource,
    RawCount: c.rawCount, Calculated: c.calculatedValue, Expected: c.expectedValue,
    Status: c.pass ? 'PASS' : 'FAIL', Notes: c.notes,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Data Accuracy Audit</h1>
        <div className="actions">
          <ExportButton data={exportData} filename="data_audit_report" label="Export Audit" />
        </div>
      </div>

      {/* Summary */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="kpi-card success">
          <div className="kpi-label">Passed</div>
          <div className="kpi-value green">{passed}</div>
          <div className="kpi-sub">of {total} checks</div>
        </div>
        <div className={`kpi-card ${failed > 0 ? 'critical' : 'success'}`}>
          <div className="kpi-label">Failed</div>
          <div className={`kpi-value ${failed > 0 ? 'red' : 'green'}`}>{failed}</div>
          <div className="kpi-sub">{failed === 0 ? 'All checks pass ✓' : 'needs attention'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Data Health</div>
          <div className={`kpi-value ${passed === total ? 'green' : failed > 3 ? 'red' : 'amber'}`}>
            {total > 0 ? ((passed / total) * 100).toFixed(0) : 0}%
          </div>
          <div className="kpi-sub">overall score</div>
        </div>
      </div>

      {/* Quick context */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>📋 Analytics Context</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <div>Total Employees: <strong style={{ color: 'var(--text-primary)' }}>{data.employees.length}</strong></div>
          <div>Active (non-terminated): <strong style={{ color: 'var(--text-primary)' }}>{analytics.totalEmployees}</strong></div>
          <div>Total Assignments: <strong style={{ color: 'var(--text-primary)' }}>{data.assignments.length}</strong></div>
          <div>Active Assignments: <strong style={{ color: 'var(--text-primary)' }}>{analytics.totalAssignments}</strong></div>
          <div>Quiz Responses: <strong style={{ color: 'var(--text-primary)' }}>{data.quizResponses.length}</strong></div>
          <div>Quiz Questions: <strong style={{ color: 'var(--text-primary)' }}>{data.quizQuestions.length}</strong></div>
        </div>
      </div>

      {/* Audit table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>✓</th>
                <th style={{ minWidth: 200 }}>Check</th>
                <th style={{ minWidth: 280 }}>Formula</th>
                <th>Raw Count</th>
                <th style={{ minWidth: 200 }}>Calculated</th>
                <th style={{ minWidth: 200 }}>Expected</th>
                <th style={{ minWidth: 300 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {checks.map(c => (
                <tr key={c.id} style={{ background: c.pass ? 'transparent' : 'rgba(239,68,68,0.05)' }}>
                  <td style={{ textAlign: 'center', fontSize: '1.1rem' }}>
                    {c.pass ? '✅' : '❌'}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.name}</td>
                  <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--accent)', wordBreak: 'break-word' }}>
                    {c.formula}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.rawCount.toLocaleString()}</td>
                  <td style={{ fontSize: '0.82rem' }}>{c.calculatedValue}</td>
                  <td style={{ fontSize: '0.82rem' }}>{c.expectedValue}</td>
                  <td style={{ fontSize: '0.78rem', color: c.pass ? 'var(--text-muted)' : 'var(--amber)', lineHeight: 1.4 }}>
                    {c.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
