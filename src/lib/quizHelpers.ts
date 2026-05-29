/**
 * quizHelpers.ts — Quiz analytics computation.
 * Pure functions for quiz score analysis.
 */

import type { QuizQuestion, QuizResponse } from '../types';
import { getTopicName } from './topicMap';

export interface QuestionStat {
  questionId: string;
  topicId: string;
  topicName: string;
  questionText: string;
  totalAnswers: number;
  correctAnswers: number;
  failRate: number;
  correctChoice: string;
  mostPickedWrong: string;
}

export interface TopicQuizStat {
  topicId: string;
  topicName: string;
  totalResponses: number;
  correctResponses: number;
  score: number;
  questionCount: number;
}

export interface EmployeeQuizResult {
  empKey: string;
  topicId: string;
  totalQuestions: number;
  correct: number;
  score: number;
  dateTime: string;
}

/**
 * Compute per-question failure stats.
 * Returns sorted by fail rate (worst first).
 */
export function computeQuestionStats(
  questions: QuizQuestion[],
  responses: QuizResponse[],
): QuestionStat[] {
  const qMap = new Map<string, QuizQuestion>();
  for (const q of questions) qMap.set(q.QuestionID, q);

  const stats = new Map<string, { total: number; correct: number; wrongPicks: Map<string, number> }>();

  for (const r of responses) {
    const stat = stats.get(r.QuestionID) || { total: 0, correct: 0, wrongPicks: new Map() };
    stat.total++;
    const isCorrect = r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y';
    if (isCorrect) {
      stat.correct++;
    } else {
      const cnt = stat.wrongPicks.get(r.SelectedAnswer) || 0;
      stat.wrongPicks.set(r.SelectedAnswer, cnt + 1);
    }
    stats.set(r.QuestionID, stat);
  }

  const result: QuestionStat[] = [];
  for (const [qId, stat] of stats) {
    const q = qMap.get(qId);
    if (!q) continue;
    let mostPickedWrong = '';
    let maxWrong = 0;
    for (const [ans, cnt] of stat.wrongPicks) {
      if (cnt > maxWrong) { maxWrong = cnt; mostPickedWrong = ans; }
    }
    result.push({
      questionId: qId,
      topicId: q.TopicID,
      topicName: getTopicName(q.TopicID),
      questionText: q.QuestionText,
      totalAnswers: stat.total,
      correctAnswers: stat.correct,
      failRate: stat.total > 0 ? (stat.total - stat.correct) / stat.total : 0,
      correctChoice: q.CorrectChoice,
      mostPickedWrong,
    });
  }

  return result.sort((a, b) => b.failRate - a.failRate);
}

/**
 * Compute quiz score per topic.
 */
export function computeTopicQuizStats(
  questions: QuizQuestion[],
  responses: QuizResponse[],
): TopicQuizStat[] {
  const qTopicMap = new Map<string, string>();
  for (const q of questions) qTopicMap.set(q.QuestionID, q.TopicID);

  const topicQCount = new Map<string, number>();
  for (const q of questions) {
    topicQCount.set(q.TopicID, (topicQCount.get(q.TopicID) || 0) + 1);
  }

  const stats = new Map<string, { total: number; correct: number }>();
  for (const r of responses) {
    const topicId = qTopicMap.get(r.QuestionID);
    if (!topicId) continue;
    const stat = stats.get(topicId) || { total: 0, correct: 0 };
    stat.total++;
    const isCorrect = r.IsCorrect === true || r.IsCorrect === 'TRUE' || r.IsCorrect === 'true' || r.IsCorrect === 'Y' || r.IsCorrect === 'y';
    if (isCorrect) stat.correct++;
    stats.set(topicId, stat);
  }

  return Array.from(stats.entries()).map(([topicId, stat]) => ({
    topicId,
    topicName: getTopicName(topicId),
    totalResponses: stat.total,
    correctResponses: stat.correct,
    score: stat.total > 0 ? (stat.correct / stat.total) * 100 : 0,
    questionCount: topicQCount.get(topicId) || 0,
  })).sort((a, b) => a.score - b.score);
}
