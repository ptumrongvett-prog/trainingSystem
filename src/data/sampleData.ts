/**
 * sampleData.ts — Realistic mock data for development.
 * Enables full dashboard development without API access.
 * Based on real Ramko data structure from Google Sheets.
 */

import type { Employee, Assignment, AssignRequest, QuizQuestion, QuizResponse, Session, CheckMissing, SummaryRow } from '../types';
import { registerTopic } from '../lib/topicMap';

/* ─── Departments & Divisions ─── */
const DEPARTMENTS = ['Operators', 'QC', 'Maintenance', 'Shipping', 'Process', 'Engineering', 'HR', 'Metrology', 'Inventory', 'Receiving', 'Planning', 'Supervisor', 'Manager', 'Breaker', 'CNC', 'Janitorial', 'Purchasing'];
const DIVISIONS = ['INJ', 'MFG'];
const SHIFTS = ['1st', '2nd', '3rd'];
const SUPERVISORS = [
  'rcabucoy@ramko-inj.com', 'cmedina@ramko-inj.com', 'dreynolds@ramko.com',
  'jalvarado@ramko-inj.com', 'hanguiano@ramko-inj.com', 'mandrei@ramko-inj.com',
  'jrathbone@ramko.com', 'rrathbone@ramko.com', 'dronning@ramko-inj.com',
];
const TOPICS = ['RMKT00001', 'RMKT00002', 'RMKT00003', 'RMKT00004', 'RMKT00005', 'RMKT00006', 'RMKT00010'];

/* Sample topic names for dev mode */
const SAMPLE_TOPIC_NAMES: Record<string, { name: string; category: string }> = {
  RMKT00001: { name: 'Workplace Safety Orientation', category: 'Safety' },
  RMKT00002: { name: 'Chemical Handling & SDS', category: 'Safety' },
  RMKT00003: { name: 'Fire Prevention & Emergency', category: 'Safety' },
  RMKT00004: { name: 'Quality Standards & ISO', category: 'Quality' },
  RMKT00005: { name: 'Machine Operation Basics', category: 'Operations' },
  RMKT00006: { name: 'PPE & Ergonomics', category: 'Safety' },
  RMKT00010: { name: 'OSHA Compliance Annual', category: 'Compliance' },
};

const FIRST_NAMES = [
  'Carmen', 'Beatriz', 'Adolph', 'Virginia', 'Alfonso', 'Jason', 'Jesus', 'Christine',
  'Maria', 'Deron', 'Matt', 'Shawndra', 'Robert', 'Dawn', 'Hilda', 'Gloria',
  'Rebeca', 'Oralia', 'Eolivia', 'Brian', 'Maribel', 'Susan', 'Tyler', 'Daniel',
  'Jerod', 'Sean', 'Chase', 'Raquel', 'Alejandra', 'Silma', 'Analilia', 'Jacob',
  'Justin', 'Mario', 'Pedro', 'Kenia', 'Miguel', 'Agustin', 'Osling', 'Alma',
  'Jose', 'Ricardo', 'Sandra', 'Martha', 'Luis', 'Rosa', 'Marco', 'Elena',
];

const LAST_NAMES = [
  'Acevedo', 'Aguirre-Nogales', 'Ahumada', 'Albino-Salgado', 'Alcala-Campos',
  'Allin', 'Alvarado', 'Alvarez', 'Anderson', 'Andrei', 'Anguiano', 'Aparicio',
  'Arroyo', 'Avalos-Villa', 'Baez Montes', 'Barragan', 'Bejar', 'Bilhardt',
  'Boydstun', 'Brown', 'Buchanan', 'Cabucoy', 'Calderon', 'Calvillo Jr',
  'Camacho', 'Cardiel', 'Carrasco', 'Casas', 'Castellon', 'Castro',
  'Cervantes', 'Chavarria', 'Cruz', 'Cubias', 'Darter', 'Davidson',
  'De La Rosa', 'Diaz', 'Estrada', 'Figueroa', 'Garcia', 'Gomez',
  'Gonzalez', 'Gutierrez', 'Hernandez', 'Lopez', 'Martinez', 'Morales',
];

/* ─── Generator Helpers ─── */

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function empKey(div: string, num: number): string { return `${div}${num}`; }
function assignId(): string { return Math.random().toString(36).substring(2, 7).toUpperCase(); }
function reqId(): string { return `REQ${Math.random().toString(36).substring(2, 7).toUpperCase()}`; }
function responseId(): string { return Math.random().toString(36).substring(2, 10); }
function questionId(n: number): string { return `Q${String(n).padStart(3, '0')}`; }
function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const d = new Date(s + Math.random() * (e - s));
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/* ─── Generate Employees (~200) ─── */

export function generateSampleEmployees(): Employee[] {
  const employees: Employee[] = [];

  for (let i = 0; i < 200; i++) {
    const div = pick(DIVISIONS);
    const dept = pick(DEPARTMENTS);
    const shift = pick(SHIFTS);
    const fname = pick(FIRST_NAMES);
    const lname = pick(LAST_NAMES);
    const num = 100 + i;
    const ek = empKey(div === 'INJ' ? 'INJ' : 'MFG', num);
    const isPerm = Math.random() > 0.15;

    employees.push({
      employee_number: String(1000 + i),
      first_name: fname,
      last_name: lname,
      supervisor: pick(SUPERVISORS),
      division: div,
      hire_date: randomDate('2000-01-01', '2025-12-31'),
      phone: Math.random() > 0.5 ? `951${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}` : '',
      shift,
      perm_temp: isPerm ? 'PERM' : 'TEMP',
      department: dept,
      EmpKey: ek,
      email: Math.random() > 0.6 ? `${fname.toLowerCase()}@ramko-inj.com` : '',
    });
  }

  return employees;
}

/* ─── Generate Assignments (~600) ─── */

export function generateSampleAssignments(employees: Employee[]): Assignment[] {
  const assignments: Assignment[] = [];

  for (const emp of employees) {
    // Each employee gets 1-4 topic assignments
    const numTopics = 1 + Math.floor(Math.random() * 4);
    const assignedTopics = new Set<string>();

    for (let t = 0; t < numTopics; t++) {
      const topic = pick(TOPICS);
      if (assignedTopics.has(topic)) continue;
      assignedTopics.add(topic);

      const dateAssigned = randomDate('2025-12-01', '2026-02-28');
      const dueDate = '1/30/2026';
      const r = Math.random();
      let status: string;
      let isActive: boolean;

      if (r < 0.65) {
        status = 'Completed';
        isActive = true;
      } else if (r < 0.85) {
        status = 'Assigned';
        isActive = true;
      } else {
        status = 'Assigned';
        isActive = Math.random() > 0.2;
      }

      assignments.push({
        AssignmentID: assignId(),
        EmpKey: emp.EmpKey,
        TopicID: topic,
        DateAssigned: dateAssigned,
        AssignMode: Math.random() > 0.4 ? 'People' : 'Department',
        DueDate: dueDate,
        Status: status,
        RequestID: reqId(),
        IsActive: isActive,
      });
    }
  }

  return assignments;
}

/* ─── Generate AssignRequests ─── */

export function generateSampleAssignRequests(): AssignRequest[] {
  const requests: AssignRequest[] = [];
  const modes = ['People', 'Department'];

  for (let i = 0; i < 35; i++) {
    const mode = pick(modes);
    const topic = pick(TOPICS);

    requests.push({
      RequestID: reqId(),
      AssignMode: mode,
      TopicID: topic,
      SelectedEmployees: mode === 'People' ? 'INJ100, INJ101, INJ102, MFG100' : '',
      SelectedPeople: mode === 'People' ? 'INJ100, INJ101' : '',
      SelectedDepartment: mode === 'Department' ? pick(DEPARTMENTS) : '',
      SelectedDivision: pick(DIVISIONS),
      RequestBy: 'ptumrongvett@ramko-inj.com',
      RequestAt: randomDate('2025-12-15', '2026-04-27'),
      DueDate: '1/30/2026',
    });
  }

  return requests;
}

/* ─── Generate QuizQuestions ─── */

export function generateSampleQuizQuestions(): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  let qNum = 1;

  for (const topic of TOPICS) {
    const numQ = 5 + Math.floor(Math.random() * 6); // 5-10 questions per topic
    for (let i = 0; i < numQ; i++) {
      const correct = pick(['ChoiceA', 'ChoiceB', 'ChoiceC', 'ChoiceD']);
      questions.push({
        QuestionID: questionId(qNum++),
        TopicID: topic,
        QuestionText: `Sample question ${qNum - 1} for ${topic}. What is the correct procedure for step ${i + 1}?`,
        ChoiceA: `Option A - procedure ${i + 1}a`,
        ChoiceB: `Option B - procedure ${i + 1}b`,
        ChoiceC: `Option C - procedure ${i + 1}c`,
        ChoiceD: `Option D - procedure ${i + 1}d`,
        CorrectChoice: correct,
      });
    }
  }

  return questions;
}

/* ─── Generate QuizResponses ─── */

export function generateSampleQuizResponses(
  assignments: Assignment[],
  questions: QuizQuestion[],
): QuizResponse[] {
  const responses: QuizResponse[] = [];
  const completedAssigns = assignments.filter(a => a.Status === 'Completed');
  const questionsByTopic = new Map<string, QuizQuestion[]>();
  for (const q of questions) {
    const arr = questionsByTopic.get(q.TopicID) || [];
    arr.push(q);
    questionsByTopic.set(q.TopicID, arr);
  }

  for (const a of completedAssigns) {
    const topicQs = questionsByTopic.get(a.TopicID) || [];
    for (const q of topicQs) {
      const isCorrect = Math.random() > 0.25; // 75% correct rate average
      const answer = isCorrect ? q.CorrectChoice : pick(['ChoiceA', 'ChoiceB', 'ChoiceC', 'ChoiceD']);
      responses.push({
        ResponseID: responseId(),
        AssignmentID: a.AssignmentID,
        EmpKey: a.EmpKey,
        QuestionID: q.QuestionID,
        SelectedAnswer: answer,
        IsCorrect: isCorrect,
        DateTime: `1/7/2026 ${10 + Math.floor(Math.random() * 4)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      });
    }
  }

  return responses;
}

/* ─── Generate Sessions ─── */

export function generateSampleSessions(employees: Employee[]): Session[] {
  const sessions: Session[] = [];
  const sessionEmps = employees.slice(0, 40);

  for (const emp of sessionEmps) {
    sessions.push({
      SessionID: responseId(),
      DeviceID: responseId(),
      DeviceUser: emp.email || `${emp.first_name.toLowerCase()}@ramko-inj.com`,
      LoggedInEmpKey: emp.EmpKey,
      InputDivision: emp.division,
      LoggedInAt: `4/27/2026 ${7 + Math.floor(Math.random() * 8)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      LoggedOutAt: Math.random() > 0.3 ? `4/27/2026 ${12 + Math.floor(Math.random() * 5)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00` : '',
      InputEmployeeNumber: emp.EmpKey,
    });
  }

  return sessions;
}

/* ─── Generate CheckMissing matrix ─── */

export function generateSampleCheckMissing(employees: Employee[]): CheckMissing[] {
  return employees.map(e => {
    const row: CheckMissing = {
      EmpKey: e.EmpKey,
      division: e.division,
      perm_temp: e.perm_temp,
      first_name: e.first_name,
      last_name: e.last_name,
    };

    for (const topic of TOPICS) {
      const r = Math.random();
      if (r < 0.7) row[topic] = 1;
      else if (r < 0.85) row[topic] = 0;
      else if (r < 0.92) row[topic] = 'No sent';
      else row[topic] = 'Sick Leave';
    }

    return row;
  });
}

/* ─── Generate Summary ─── */

export function generateSampleSummary(assignments: Assignment[]): SummaryRow[] {
  const topicMap = new Map<string, { assigned: number; completed: number }>();

  for (const a of assignments) {
    const stat = topicMap.get(a.TopicID) || { assigned: 0, completed: 0 };
    stat.assigned++;
    if (a.Status === 'Completed') stat.completed++;
    topicMap.set(a.TopicID, stat);
  }

  return Array.from(topicMap.entries()).map(([topicId, stat]) => ({
    TopicID: topicId,
    Assigned: stat.assigned,
    Completed: stat.completed,
    Total: stat.assigned,
    Variance: stat.assigned - stat.completed,
  }));
}

/* ─── Build Complete Sample Dataset ─── */

export function buildSampleData() {
  // Register sample topic names for readable display
  for (const [id, meta] of Object.entries(SAMPLE_TOPIC_NAMES)) {
    registerTopic(id, { name: meta.name, category: meta.category, requiredBy: ['all'], frequency: 'annual' });
  }

  const employees = generateSampleEmployees();
  const assignments = generateSampleAssignments(employees);
  const assignRequests = generateSampleAssignRequests();
  const quizQuestions = generateSampleQuizQuestions();
  const quizResponses = generateSampleQuizResponses(assignments, quizQuestions);
  const sessions = generateSampleSessions(employees);
  const checkMissing = generateSampleCheckMissing(employees);
  const summary = generateSampleSummary(assignments);

  return {
    employees,
    assignments,
    assignRequests,
    quizQuestions,
    quizResponses,
    sessions,
    checkMissing,
    summary,
  };
}
