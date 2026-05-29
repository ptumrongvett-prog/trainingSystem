/**
 * insights.ts — AI-ready rule-based insight engine.
 * Generates human-readable insights from analytics snapshots.
 * Structured so an LLM can be plugged in later.
 */

import type { Insight, InsightCategory, AlertSeverity, AnalyticsSnapshot } from '../types';

let insightCounter = 0;
function nextId(): string {
  return `insight-${++insightCounter}`;
}

/**
 * Generate rule-based insights from an analytics snapshot.
 * Returns 4 categories: risk, attention, followup, failure.
 */
export function generateInsights(snapshot: AnalyticsSnapshot): Insight[] {
  const insights: Insight[] = [];

  insights.push(...riskInsights(snapshot));
  insights.push(...attentionInsights(snapshot));
  insights.push(...followupInsights(snapshot));
  insights.push(...failureInsights(snapshot));

  return insights;
}

/* ─── Risk ─── */

function riskInsights(s: AnalyticsSnapshot): Insight[] {
  const insights: Insight[] = [];

  if (s.highRiskDepartments.length > 0) {
    const depts = s.highRiskDepartments.map(d => d.department);
    insights.push({
      id: nextId(),
      category: 'risk',
      title: 'Top Risks This Week',
      description: `${depts.length} department${depts.length > 1 ? 's' : ''} below 80% completion: ${depts.slice(0, 5).join(', ')}${depts.length > 5 ? ` and ${depts.length - 5} more` : ''}.`,
      severity: depts.length >= 3 ? 'critical' : 'warning',
      data: { departments: s.highRiskDepartments },
      suggestedAction: `Focus training resources on ${depts[0]} department first — it has the lowest completion rate.`,
    });
  }

  if (s.overdueCount > 0) {
    const pct = s.totalAssignments > 0 ? ((s.overdueCount / s.totalAssignments) * 100).toFixed(1) : '0';
    insights.push({
      id: nextId(),
      category: 'risk',
      title: 'Overdue Training Alert',
      description: `${s.overdueCount} assignments are overdue (${pct}% of total). This impacts compliance readiness.`,
      severity: s.overdueCount > 20 ? 'critical' : 'warning',
      data: { overdueCount: s.overdueCount, percentage: pct },
      suggestedAction: 'Review overdue list and contact supervisors for immediate follow-up.',
    });
  }

  return insights;
}

/* ─── Attention ─── */

function attentionInsights(s: AnalyticsSnapshot): Insight[] {
  const insights: Insight[] = [];

  // Find departments needing attention (50-80% completion)
  const needAttention = s.departmentBreakdown.filter(d => d.rate >= 0.5 && d.rate < 0.8 && d.total >= 5);
  if (needAttention.length > 0) {
    insights.push({
      id: nextId(),
      category: 'attention',
      title: 'Departments Needing Attention',
      description: `${needAttention.length} department${needAttention.length > 1 ? 's have' : ' has'} completion rates between 50-80%: ${needAttention.map(d => `${d.department} (${(d.rate * 100).toFixed(0)}%)`).join(', ')}.`,
      severity: 'warning',
      data: { departments: needAttention },
      suggestedAction: 'Schedule reminder sessions for these departments before they fall into high-risk.',
    });
  }

  // Low overall completion
  if (s.completionRate < 0.7 && s.totalAssignments > 0) {
    insights.push({
      id: nextId(),
      category: 'attention',
      title: 'Overall Completion Below Target',
      description: `Overall completion rate is ${(s.completionRate * 100).toFixed(1)}%, below the 70% target.`,
      severity: 'critical',
      data: { completionRate: s.completionRate },
      suggestedAction: 'Consider extending due dates or adding more training sessions.',
    });
  }

  return insights;
}

/* ─── Follow-up ─── */

function followupInsights(s: AnalyticsSnapshot): Insight[] {
  const insights: Insight[] = [];

  // Supervisors with most overdue
  const topSupervisors = s.supervisorSummary.filter(sv => sv.overdueCount > 0).slice(0, 3);
  if (topSupervisors.length > 0) {
    insights.push({
      id: nextId(),
      category: 'followup',
      title: 'Suggested Follow-Up Actions',
      description: `Top supervisors needing follow-up: ${topSupervisors.map(sv => `${sv.supervisor.split('@')[0]} (${sv.overdueCount} overdue)`).join(', ')}.`,
      severity: topSupervisors[0].overdueCount > 5 ? 'warning' : 'info',
      data: { supervisors: topSupervisors },
      suggestedAction: `Contact ${topSupervisors[0].supervisor.split('@')[0]} first — they have the most overdue employees.`,
    });
  }

  // Employees missing required training
  if (s.missingRequired.length > 0) {
    insights.push({
      id: nextId(),
      category: 'followup',
      title: 'Employees Missing Required Training',
      description: `${s.missingRequired.length} employee${s.missingRequired.length > 1 ? 's are' : ' is'} missing required training for their department.`,
      severity: s.missingRequired.length > 10 ? 'warning' : 'info',
      data: { count: s.missingRequired.length, sample: s.missingRequired.slice(0, 5) },
      suggestedAction: 'Export the missing training list and assign through AppSheet.',
    });
  }

  return insights;
}

/* ─── Failure ─── */

function failureInsights(s: AnalyticsSnapshot): Insight[] {
  const insights: Insight[] = [];

  if (s.mostFailedTopic.failRate > 0.3 && s.mostFailedTopic.topicId) {
    insights.push({
      id: nextId(),
      category: 'failure',
      title: 'Topics with High Failure Rate',
      description: `"${s.mostFailedTopic.name}" has a ${(s.mostFailedTopic.failRate * 100).toFixed(0)}% failure rate on quiz questions.`,
      severity: s.mostFailedTopic.failRate > 0.5 ? 'critical' : 'warning',
      data: { topic: s.mostFailedTopic },
      suggestedAction: 'Review quiz questions for clarity and consider updating training material.',
    });
  }

  if (s.avgQuizScore < 70 && s.avgQuizScore > 0) {
    insights.push({
      id: nextId(),
      category: 'failure',
      title: 'Low Overall Quiz Performance',
      description: `Average quiz score is ${s.avgQuizScore.toFixed(1)}%, indicating training material may need improvement.`,
      severity: 'warning',
      data: { avgScore: s.avgQuizScore },
      suggestedAction: 'Analyze most-missed questions and update training content accordingly.',
    });
  }

  return insights;
}

/* ─── Future LLM Integration ─── */

/**
 * Build a prompt for an LLM to generate additional insights.
 * This is structured for future integration — not used yet.
 */
export function buildLLMPrompt(insights: Insight[], snapshot: AnalyticsSnapshot): string {
  return `You are analyzing training compliance data for a manufacturing company.

Current metrics:
- Total employees: ${snapshot.totalEmployees}
- Total assignments: ${snapshot.totalAssignments}
- Completion rate: ${(snapshot.completionRate * 100).toFixed(1)}%
- Overdue: ${snapshot.overdueCount}
- High-risk departments: ${snapshot.highRiskDepartments.map(d => d.department).join(', ') || 'None'}
- Average quiz score: ${snapshot.avgQuizScore.toFixed(1)}%
- Most failed topic: ${snapshot.mostFailedTopic.name} (${(snapshot.mostFailedTopic.failRate * 100).toFixed(0)}% fail rate)

Existing rule-based insights:
${insights.map(i => `- [${i.category}] ${i.title}: ${i.description}`).join('\n')}

Based on this data, provide:
1. Three additional insights not covered above
2. Priority recommendations for the next 7 days
3. Any patterns that suggest systemic issues

Format your response as JSON with fields: title, description, suggestedAction, severity.`;
}
