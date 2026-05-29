import { useDataStore } from '../../hooks/useDataStore';
import { isTopicNameMissing } from '../../lib/topicMap';

export default function KpiCards() {
  const { analytics } = useDataStore();

  const cards = [
    {
      label: 'Completion Rate',
      value: `${(analytics.completionRate * 100).toFixed(1)}%`,
      color: analytics.completionRate >= 0.8 ? 'green' : analytics.completionRate >= 0.6 ? 'amber' : 'red',
      tier: analytics.completionRate >= 0.8 ? 'success' : analytics.completionRate >= 0.6 ? 'warning' : 'critical',
      sub: `${analytics.totalAssignments} total assignments`,
    },
    {
      label: 'Overdue Training',
      value: String(analytics.overdueCount),
      color: analytics.overdueCount === 0 ? 'green' : analytics.overdueCount <= 10 ? 'amber' : 'red',
      tier: analytics.overdueCount === 0 ? 'success' : analytics.overdueCount <= 10 ? 'warning' : 'critical',
      sub: 'assignments past due',
    },
    {
      label: 'High-Risk Departments',
      value: String(analytics.highRiskDepartments.length),
      color: analytics.highRiskDepartments.length === 0 ? 'green' : 'red',
      tier: analytics.highRiskDepartments.length === 0 ? 'success' : 'critical',
      sub: analytics.highRiskDepartments.length > 0
        ? analytics.highRiskDepartments.slice(0, 2).map(d => d.department).join(', ')
        : 'All departments on track',
    },
    {
      label: 'Missing Required',
      value: String(analytics.missingRequired.length),
      color: analytics.missingRequired.length === 0 ? 'green' : analytics.missingRequired.length <= 5 ? 'amber' : 'red',
      tier: analytics.missingRequired.length === 0 ? 'success' : 'warning',
      sub: 'employees missing training',
    },
    {
      label: 'Avg Quiz Score',
      value: analytics.avgQuizScore > 0 ? `${analytics.avgQuizScore.toFixed(0)}%` : 'N/A',
      color: analytics.avgQuizScore >= 80 ? 'green' : analytics.avgQuizScore >= 60 ? 'amber' : 'blue',
      tier: analytics.avgQuizScore >= 80 ? 'success' : analytics.avgQuizScore >= 60 ? 'warning' : '',
      sub: 'across all topics',
    },
    {
      label: 'Most Failed Topic',
      value: analytics.mostFailedTopic.topicId
        ? `${(analytics.mostFailedTopic.failRate * 100).toFixed(0)}%`
        : 'N/A',
      color: 'purple',
      tier: analytics.mostFailedTopic.failRate > 0.3 ? 'warning' : '',
      sub: analytics.mostFailedTopic.topicId
        ? `${analytics.mostFailedTopic.name}${isTopicNameMissing(analytics.mostFailedTopic.topicId) ? ' ⚠ Name missing' : ''}`
        : 'No quiz data',
    },
    {
      label: 'Completed This Week',
      value: String(analytics.weeklyCompleted),
      color: 'blue',
      tier: '',
      sub: 'training completions',
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map(card => (
        <div key={card.label} className={`kpi-card ${card.tier}`}>
          <div className="kpi-label">{card.label}</div>
          <div className={`kpi-value ${card.color}`}>{card.value}</div>
          <div className="kpi-sub">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
