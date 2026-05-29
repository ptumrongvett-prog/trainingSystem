/**
 * DataQualityPage.tsx — Data Quality dashboard.
 * Shows health score, category breakdown, and 12 individual checks.
 * Additive only (Phase 5).
 */

import { useState, useMemo } from 'react';
import { useDataStore } from '../../hooks/useDataStore';
import { runDataQualityChecks } from '../../lib/dataQuality';
import { computeRiskScores } from '../../lib/riskScoring';
import type { DataQualityCheck } from '../../lib/dataQuality';
import type { EmployeeRisk } from '../../lib/riskScoring';
import RiskBadge from '../shared/RiskBadge';
import ExportButton from '../shared/ExportButton';

const CATEGORY_ICONS: Record<string, string> = {
  completeness: '📦', consistency: '🔗', accuracy: '🎯', timeliness: '⏱️',
};

const SEV_ICON: Record<string, string> = {
  error: '🔴', warning: '🟠', info: '🔵',
};

export default function DataQualityPage() {
  const { filteredData } = useDataStore();
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [riskView, setRiskView] = useState(false);
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const report = useMemo(
    () => runDataQualityChecks(
      filteredData.employees, filteredData.assignments,
      filteredData.quizResponses, filteredData.sessions,
    ),
    [filteredData],
  );

  const topicIds = useMemo(() =>
    [...new Set(filteredData.assignments.map(a => a.TopicID))],
    [filteredData.assignments],
  );

  const riskProfiles = useMemo(
    () => computeRiskScores(
      filteredData.employees, filteredData.assignments,
      filteredData.quizResponses, filteredData.sessions, topicIds,
    ),
    [filteredData, topicIds],
  );

  const filteredRisk = useMemo(() => {
    if (riskFilter === 'all') return riskProfiles;
    return riskProfiles.filter(r => r.riskLevel === riskFilter);
  }, [riskProfiles, riskFilter]);

  // Category breakdown
  const categories = useMemo(() => {
    const cats = new Map<string, { total: number; sum: number }>();
    for (const c of report.checks) {
      const stat = cats.get(c.category) || { total: 0, sum: 0 };
      stat.total++;
      stat.sum += c.healthPct;
      cats.set(c.category, stat);
    }
    return [...cats.entries()].map(([cat, stat]) => ({
      category: cat, health: stat.sum / stat.total,
    }));
  }, [report]);

  // Risk distribution
  const riskDist = useMemo(() => ({
    critical: riskProfiles.filter(r => r.riskLevel === 'critical').length,
    high: riskProfiles.filter(r => r.riskLevel === 'high').length,
    medium: riskProfiles.filter(r => r.riskLevel === 'medium').length,
    low: riskProfiles.filter(r => r.riskLevel === 'low').length,
  }), [riskProfiles]);

  const healthColor = report.overallHealth >= 95 ? 'var(--green)' :
    report.overallHealth >= 80 ? 'var(--amber)' : 'var(--red)';

  const dqExport = report.checks.map(c => ({
    Status: c.passed ? 'PASS' : 'FAIL', Severity: c.severity,
    Category: c.category, Check: c.name,
    Affected: c.affectedCount, Total: c.totalCount,
    Health: `${c.healthPct.toFixed(1)}%`, Examples: c.examples.join('; '),
  }));

  const riskExport = filteredRisk.map(r => ({
    Employee: r.name, EmpKey: r.empKey, Dept: r.department,
    Division: r.division, Supervisor: r.supervisor,
    RiskScore: r.riskScore, RiskLevel: r.riskLevel,
    Overdue: r.overdueCount, Completion: `${(r.completionRate * 100).toFixed(1)}%`,
    QuizScore: `${(r.avgQuizScore * 100).toFixed(0)}%`,
    MissingTopics: r.missingTopicCount, DaysSinceLogin: r.daysSinceLogin,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>{riskView ? 'Employee Risk Scoring' : 'Data Quality Dashboard'}</h1>
        <div className="actions">
          <button
            className={`btn ${riskView ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => setRiskView(false)} style={{ fontSize: '0.8rem' }}
          >🔍 Data Quality</button>
          <button
            className={`btn ${riskView ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRiskView(true)} style={{ fontSize: '0.8rem' }}
          >⚠️ Risk Scoring</button>
          <ExportButton data={riskView ? riskExport : dqExport}
            filename={riskView ? 'risk_scores' : 'data_quality'} label="Export" />
        </div>
      </div>

      {!riskView ? (
        <>
          {/* Health Summary */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
            <div className="kpi-card">
              <div className="kpi-label">Overall Health</div>
              <div className="kpi-value" style={{ color: healthColor }}>{report.overallHealth.toFixed(1)}%</div>
              <div className="kpi-sub">{report.checks.length} checks run</div>
            </div>
            <div className={`kpi-card ${report.errorCount > 0 ? 'critical' : 'success'}`}>
              <div className="kpi-label">Errors</div>
              <div className={`kpi-value ${report.errorCount > 0 ? 'red' : 'green'}`}>{report.errorCount}</div>
            </div>
            <div className={`kpi-card ${report.warningCount > 0 ? 'warning' : 'success'}`}>
              <div className="kpi-label">Warnings</div>
              <div className={`kpi-value ${report.warningCount > 0 ? 'amber' : 'green'}`}>{report.warningCount}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Info</div>
              <div className="kpi-value blue">{report.infoCount}</div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {categories.map(cat => {
              const catColor = cat.health >= 95 ? 'var(--green)' : cat.health >= 80 ? 'var(--amber)' : 'var(--red)';
              return (
                <div key={cat.category} style={{
                  flex: '1 1 200px', padding: '12px 16px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{CATEGORY_ICONS[cat.category] || '📊'}</span>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{cat.category}</div>
                    <div style={{ fontWeight: 700, color: catColor, fontSize: '1.1rem' }}>{cat.health.toFixed(1)}%</div>
                  </div>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${cat.health}%`, height: '100%', background: catColor, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Check Table */}
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>✓</th>
                  <th style={{ width: 36 }}>Sev</th>
                  <th>Check Name</th>
                  <th>Category</th>
                  <th>Affected</th>
                  <th>Total</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {report.checks.map(check => (
                  <CheckRow key={check.id} check={check}
                    isExpanded={expandedCheck === check.id}
                    onToggle={() => setExpandedCheck(prev => prev === check.id ? null : check.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Risk Summary */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
            {(['critical', 'high', 'medium', 'low'] as const).map(level => {
              const count = riskDist[level];
              const isActive = riskFilter === level;
              return (
                <div key={level}
                  className={`kpi-card ${count > 0 && (level === 'critical' || level === 'high') ? 'critical' : ''}`}
                  onClick={() => setRiskFilter(prev => prev === level ? 'all' : level)}
                  style={{ cursor: 'pointer', outline: isActive ? '2px solid var(--accent)' : 'none' }}
                >
                  <div className="kpi-label" style={{ textTransform: 'capitalize' }}>{level} Risk</div>
                  <div className="kpi-value" style={{
                    color: level === 'critical' ? 'var(--red)' : level === 'high' ? '#f97316' :
                      level === 'medium' ? 'var(--amber)' : 'var(--green)',
                  }}>{count}</div>
                </div>
              );
            })}
          </div>

          {/* Risk Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Employee</th>
                    <th>Dept</th>
                    <th>Supervisor</th>
                    <th>Score</th>
                    <th>Overdue</th>
                    <th>Completion</th>
                    <th>Quiz</th>
                    <th>Inactive</th>
                    <th>Factors</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisk.slice(0, 100).map(r => (
                    <tr key={r.empKey}>
                      <td><RiskBadge level={r.riskLevel} compact /></td>
                      <td style={{ fontWeight: 500 }}>
                        {r.name}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>{r.empKey}</span>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{r.department}</td>
                      <td style={{ fontSize: '0.82rem' }}>{r.supervisor.split('@')[0]}</td>
                      <td style={{ fontWeight: 700, color: scoreColor(r.riskScore) }}>{r.riskScore}</td>
                      <td style={{ color: r.overdueCount > 0 ? 'var(--red)' : 'inherit', fontWeight: r.overdueCount > 0 ? 700 : 400 }}>{r.overdueCount}</td>
                      <td style={{ color: r.completionRate >= 0.8 ? 'var(--green)' : 'var(--amber)' }}>{(r.completionRate * 100).toFixed(0)}%</td>
                      <td>{r.avgQuizScore > 0 ? `${(r.avgQuizScore * 100).toFixed(0)}%` : '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.daysSinceLogin}d</td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {r.factors.filter(f => f.contribution > 0).map(f =>
                          `${f.name.split(' ')[0]}:${f.contribution.toFixed(0)}`
                        ).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CheckRow({ check, isExpanded, onToggle }: {
  check: DataQualityCheck; isExpanded: boolean; onToggle: () => void;
}) {
  const healthColor = check.healthPct >= 99 ? 'var(--green)' : check.healthPct >= 90 ? 'var(--amber)' : 'var(--red)';
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: check.examples.length > 0 ? 'pointer' : 'default' }}>
        <td style={{ textAlign: 'center', fontSize: '0.9rem' }}>{check.passed ? '✅' : '❌'}</td>
        <td style={{ textAlign: 'center' }}>{SEV_ICON[check.severity]}</td>
        <td style={{ fontWeight: 500 }}>{check.name}</td>
        <td style={{ textTransform: 'capitalize', fontSize: '0.82rem' }}>{check.category}</td>
        <td style={{ color: check.affectedCount > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{check.affectedCount}</td>
        <td style={{ color: 'var(--text-muted)' }}>{check.totalCount}</td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 40, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${check.healthPct}%`, height: '100%', background: healthColor, borderRadius: 3 }} />
            </div>
            <span style={{ color: healthColor, fontSize: '0.82rem', fontWeight: 600 }}>{check.healthPct.toFixed(1)}%</span>
          </div>
        </td>
      </tr>
      {isExpanded && check.examples.length > 0 && (
        <tr>
          <td colSpan={7} style={{ padding: '8px 24px 12px', background: 'var(--bg-primary)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <strong>Examples ({check.affectedCount} total):</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {check.examples.map((ex, i) => <li key={i}>{ex}</li>)}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function scoreColor(score: number): string {
  if (score >= 76) return 'var(--red)';
  if (score >= 51) return '#f97316';
  if (score >= 26) return 'var(--amber)';
  return 'var(--green)';
}
