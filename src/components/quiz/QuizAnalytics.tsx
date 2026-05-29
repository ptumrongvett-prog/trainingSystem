import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useDataStore } from '../../hooks/useDataStore';
import { computeQuestionStats, computeTopicQuizStats } from '../../lib/quizHelpers';
import ExportButton from '../shared/ExportButton';
import EmptyState from '../shared/EmptyState';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function QuizAnalytics() {
  const { data, filteredData } = useDataStore();

  const topicStats = useMemo(
    () => computeTopicQuizStats(data.quizQuestions, filteredData.quizResponses),
    [data.quizQuestions, filteredData.quizResponses]
  );

  const questionStats = useMemo(
    () => computeQuestionStats(data.quizQuestions, filteredData.quizResponses),
    [data.quizQuestions, filteredData.quizResponses]
  );

  const topMissed = questionStats.slice(0, 15);

  const scoreChartData = useMemo(() => ({
    labels: topicStats.map(t => t.topicId),
    datasets: [{
      label: 'Average Score %',
      data: topicStats.map(t => t.score),
      backgroundColor: topicStats.map(t => t.score >= 80 ? '#00d4aa' : t.score >= 60 ? '#f59e0b' : '#ef4444'),
      borderRadius: 4,
    }],
  }), [topicStats]);

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e2a4a' } },
      y: { ticks: { color: '#64748b', callback: (v: number | string) => `${v}%` }, grid: { color: '#1e2a4a' }, max: 100 },
    },
  };

  const exportQuestions = topMissed.map(q => ({
    QuestionID: q.questionId, Topic: q.topicName, Question: q.questionText,
    FailRate: `${(q.failRate * 100).toFixed(1)}%`, TotalAnswers: q.totalAnswers,
    CorrectChoice: q.correctChoice, MostPickedWrong: q.mostPickedWrong,
  }));

  if (filteredData.quizResponses.length === 0) {
    return <EmptyState icon="📝" title="No Quiz Data" message="No quiz responses found in the current filtered data." />;
  }

  const overallCorrect = filteredData.quizResponses.filter(r => r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y').length;
  const overallScore = (overallCorrect / filteredData.quizResponses.length) * 100;

  return (
    <div>
      <div className="page-header">
        <h1>Quiz Analytics</h1>
        <div className="actions">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {filteredData.quizResponses.length.toLocaleString()} total responses
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="kpi-card"><div className="kpi-label">Overall Score</div><div className={`kpi-value ${overallScore >= 80 ? 'green' : overallScore >= 60 ? 'amber' : 'red'}`}>{overallScore.toFixed(1)}%</div><div className="kpi-sub">{overallCorrect.toLocaleString()} / {filteredData.quizResponses.length.toLocaleString()} correct</div></div>
        <div className="kpi-card"><div className="kpi-label">Topics Tested</div><div className="kpi-value blue">{topicStats.length}</div><div className="kpi-sub">{data.quizQuestions.length} total questions</div></div>
        <div className="kpi-card"><div className="kpi-label">Hardest Topic</div><div className="kpi-value red">{topicStats.length > 0 ? `${topicStats[0].score.toFixed(0)}%` : 'N/A'}</div><div className="kpi-sub">{topicStats[0]?.topicId || '—'}</div></div>
        <div className="kpi-card"><div className="kpi-label">Most Missed Q</div><div className="kpi-value purple">{topMissed.length > 0 ? `${(topMissed[0].failRate * 100).toFixed(0)}%` : 'N/A'}</div><div className="kpi-sub">fail rate — {topMissed[0]?.questionId || '—'}</div></div>
      </div>

      {/* Score by topic chart */}
      <div className="chart-card" style={{ marginBottom: 20 }}>
        <h3>📊 Average Score by Topic</h3>
        <div style={{ height: 250 }}>
          <Bar data={scoreChartData} options={chartOpts} />
        </div>
      </div>

      {/* Most missed questions */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>❌ Most Missed Questions (Top 15)</h3>
          <ExportButton data={exportQuestions} filename="most_missed_questions" label="Export" />
        </div>
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Question</th><th>Topic</th><th>Fail Rate</th><th>Answers</th><th>Correct</th><th>Most Wrong</th></tr>
            </thead>
            <tbody>
              {topMissed.map((q, i) => (
                <tr key={q.questionId}>
                  <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td style={{ maxWidth: 350, fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 500 }}>{q.questionId}</span>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 350 }}>
                      {q.questionText}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{q.topicId}</td>
                  <td>
                    <span style={{ color: q.failRate >= 0.5 ? 'var(--red)' : q.failRate >= 0.3 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
                      {(q.failRate * 100).toFixed(1)}%
                    </span>
                    <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 4 }}>
                      <div style={{ width: `${q.failRate * 100}%`, height: '100%', background: q.failRate >= 0.5 ? 'var(--red)' : 'var(--amber)', borderRadius: 2 }} />
                    </div>
                  </td>
                  <td>{q.totalAnswers}</td>
                  <td style={{ color: 'var(--green)', fontSize: '0.8rem' }}>{q.correctChoice}</td>
                  <td style={{ color: 'var(--red)', fontSize: '0.8rem' }}>{q.mostPickedWrong || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Topic detail table */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>📋 Score by Topic Detail</h3>
        <table className="data-table">
          <thead><tr><th>Topic</th><th>Questions</th><th>Responses</th><th>Correct</th><th>Score</th></tr></thead>
          <tbody>
            {topicStats.map(t => (
              <tr key={t.topicId}>
                <td style={{ fontWeight: 600 }}>{t.topicId}</td>
                <td>{t.questionCount}</td>
                <td>{t.totalResponses.toLocaleString()}</td>
                <td style={{ color: 'var(--green)' }}>{t.correctResponses.toLocaleString()}</td>
                <td><span style={{ color: t.score >= 80 ? 'var(--green)' : t.score >= 60 ? 'var(--amber)' : 'var(--red)', fontWeight: 700 }}>{t.score.toFixed(1)}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
