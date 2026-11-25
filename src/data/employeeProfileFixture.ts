/**
 * Fixture QC, FN-112, and topic data for tests and the dev-only
 * `?fixture=employee-profile` review path. Never written to Firestore.
 */

import type { Assignment, Employee } from '../types';
import type { Fn135Submission } from '../lib/fn135Records';
import { parseFn135ForEmployee } from '../lib/fn135Records';
import {
  aggregatePartTraining,
  type EmployeePartSummary,
  type PartTrainingReport,
  type RawTrainingRow,
} from '../lib/partTraining';
import {
  parseQcEmployee,
  parseQcSummary,
  type QcEmployeeHistory,
  type QcSummary,
} from '../lib/qcContract';

/** Fixed clock so overdue/pending topic status does not drift. */
export const FIXTURE_TODAY = new Date(2026, 10, 25);

const trainingLog: RawTrainingRow[] = [
  { part: '2045158-00-D', empId: '6876', empName: 'MARIA FROM LOG', trainingDate: '6/2/2026' },
  { part: '2045158-00-D', empId: '6876', empName: 'MARIA FROM LOG', trainingDate: '6/2/2026' },
  { part: '2045158-00-D', empId: '6876', empName: 'MARIA FROM LOG', trainingDate: '7/15/2026' },
  { part: '2045158-00-D', empId: '06876', empName: 'MARIA FROM LOG', trainingDate: '8/18/2026' },
  { part: '330355T', empId: '6,876', empName: 'old log name', trainingDate: '11/4/2025' },
  { part: '330355T', empId: '6876', empName: 'MARIA FROM LOG', trainingDate: '1/20/2026' },
  { part: '1093472-00-F', empId: '6388', empName: 'MIGUEL PIRIR', trainingDate: '1/8/2026' },
  { part: '1093472-00-F', empId: '6388', empName: 'MIGUEL PIRIR', trainingDate: '4/2/2026' },
  { part: '2045158-00-D', empId: '6388', empName: 'MIGUEL PIRIR', trainingDate: '2/11/2026' },
  { part: 'PART-OLD', empId: '2104', empName: 'Luis Ortega', trainingDate: '2/1/2024' },
  { part: '1093472-00-F', empId: '4501', empName: 'ROSA FROM LOG', trainingDate: '3/1/2026' },
  { part: '1093472-00-F', empId: '4501', empName: 'ROSA FROM LOG', trainingDate: '5/12/2026' },
];

const activeEmployees = new Map<string, string>([
  ['6876', 'Maria Carrera'],
  ['6388', 'Miguel Pirir'],
  ['4501', 'Rosa Diaz'],
]);

export function fixturePartReport(): PartTrainingReport {
  return aggregatePartTraining(trainingLog, activeEmployees, FIXTURE_TODAY);
}

export function fixturePartEmployees(): EmployeePartSummary[] {
  return fixturePartReport().employees;
}

function directoryEmployee(partial: Pick<Employee, 'employee_number' | 'first_name' | 'last_name' | 'department' | 'shift' | 'EmpKey'> & { division?: string }): Employee {
  return {
    employee_number: partial.employee_number,
    first_name: partial.first_name,
    last_name: partial.last_name,
    supervisor: 'rcabucoy@ramko-inj.com',
    division: partial.division ?? 'INJ',
    hire_date: '3/14/2019',
    phone: '',
    shift: partial.shift,
    perm_temp: 'PERM',
    department: partial.department,
    EmpKey: partial.EmpKey,
    email: '',
  };
}

export const FIXTURE_DIRECTORY: Employee[] = [
  directoryEmployee({
    employee_number: '6876', first_name: 'Maria', last_name: 'Carrera',
    department: 'Operators', shift: '1st', EmpKey: 'INJ6876',
  }),
  directoryEmployee({
    employee_number: '6388', first_name: 'Miguel', last_name: 'Pirir',
    department: 'Operators', shift: '2nd', EmpKey: 'INJ6388',
  }),
  directoryEmployee({
    employee_number: '4501', first_name: 'Rosa', last_name: 'Diaz',
    department: 'QC', shift: '1st', EmpKey: 'INJ4501',
  }),
];

export const FIXTURE_TOPIC_NAMES: Record<string, string> = {
  RMKT00002: 'Chemical Handling & SDS',
  RMKT00004: 'Quality Standards & ISO',
  RMKT00005: 'Machine Operation Basics',
  RMKT00010: 'OSHA Compliance Annual',
};

function assignment(partial: Pick<Assignment, 'AssignmentID' | 'EmpKey' | 'TopicID' | 'DateAssigned' | 'DueDate' | 'Status'>): Assignment {
  return {
    ...partial,
    AssignMode: 'People',
    IsActive: true,
  };
}

export const FIXTURE_ASSIGNMENTS: Assignment[] = [
  assignment({
    AssignmentID: 'A-6876-04', EmpKey: 'INJ6876', TopicID: 'RMKT00004',
    DateAssigned: '1/6/2026', DueDate: '3/31/2026', Status: 'Completed',
  }),
  assignment({
    AssignmentID: 'A-6876-05', EmpKey: 'INJ6876', TopicID: 'RMKT00005',
    DateAssigned: '2/2/2026', DueDate: '6/30/2026', Status: 'Assigned',
  }),
  assignment({
    AssignmentID: 'A-6876-02', EmpKey: 'INJ6876', TopicID: 'RMKT00002',
    DateAssigned: '10/1/2026', DueDate: '12/15/2026', Status: 'Assigned',
  }),
  assignment({
    AssignmentID: 'A-6388-10', EmpKey: 'INJ6388', TopicID: 'RMKT00010',
    DateAssigned: '1/15/2026', DueDate: '4/15/2026', Status: 'Completed',
  }),
  assignment({
    AssignmentID: 'A-4501-04', EmpKey: 'INJ4501', TopicID: 'RMKT00004',
    DateAssigned: '3/2/2026', DueDate: '8/1/2026', Status: 'Assigned',
  }),
];

const qcDocs: { id: string; data: Record<string, unknown> }[] = [
  {
    id: '06876',
    data: {
      employee_id: '6,876',
      employee_name: 'Maria Carrera',
      incident_count: 4,
      open_count: 2,
      resolved_count: 2,
      latest_incident_at: '2026-10-22T11:05:00',
      categories: [
        { category: 'Flash', count: 2 },
        { category: 'Short Part', count: 1 },
        { category: 'Warp / Deformation', count: 1 },
      ],
      parts: [
        { part_number: '2045158-00-D', part_description: 'Cover, front', count: 2 },
        { part_number: '8801001-00-B', part_description: 'Clip', count: 1 },
        { part_number: '330355T', part_description: 'Bracket', count: 1 },
      ],
      repeated_patterns: [
        { part_number: '2045158-00-D', category: 'Flash', count: 2 },
      ],
      incidents: [
        {
          incident_code: 'QC-1044',
          created_at: '2026-07-10',
          status: 'RESOLVED',
          part_number: '2045158-00-D',
          part_description: 'Cover, front',
          job_number: 'J-44120',
          machine: 'IMM-12',
          shift_name: '1st',
          categories: ['Flash'],
          problem: 'Flash along the gate after the tool change.',
          latest_action: {
            text: 'Reviewed the gate cut with the operator.',
            by: 'Ana Ruiz',
            at: '2026-07-10T15:20:00',
          },
          action_count: 1,
          media_count: 1,
          resolved_at: '2026-07-11',
        },
        {
          incident_code: 'QC-1102',
          created_at: '2026-09-03',
          status: 'OPEN',
          part_number: '2045158-00-D',
          part_description: 'Cover, front',
          job_number: 'J-45880',
          machine: 'IMM-12',
          shift_name: '1st',
          categories: ['Flash'],
          problem: 'Flash returned at the same gate on the next run.',
          latest_action: {
            text: 'Retrain scheduled on flash at the gate.',
            by: 'Ana Ruiz',
            at: '2026-09-04T09:30:00',
          },
          action_count: 2,
          media_count: 3,
          resolved_at: null,
        },
        {
          incident_code: 'QC-0988',
          created_at: '2026-05-12',
          status: 'RESOLVED',
          part_number: '8801001-00-B',
          part_description: 'Clip',
          job_number: 'J-43002',
          machine: 'IMM-4',
          shift_name: '2nd',
          categories: ['Short Part'],
          problem: 'Short shot on the clip. No FN-112 row for this part.',
          latest_action: null,
          action_count: 0,
          media_count: 0,
          resolved_at: '2026-05-13',
        },
        {
          incident_code: 'QC-1155',
          created_at: '2026-10-22',
          status: 'IN_PROGRESS',
          part_number: '330355T',
          part_description: 'Bracket',
          job_number: 'J-47011',
          machine: 'IMM-7',
          shift_name: '1st',
          categories: ['Warp / Deformation'],
          problem: 'Bracket warped after ejection.',
          latest_action: {
            text: 'Asked the lead to check the cooling fixture.',
            by: 'Ana Ruiz',
            at: '2026-10-22T11:05:00',
          },
          action_count: 1,
          media_count: 2,
          resolved_at: null,
        },
      ],
      synced_at: '2026-11-25T06:00:00',
    },
  },
  {
    id: '6388',
    data: {
      employee_id: '6388',
      employee_name: 'Miguel Pirir',
      incident_count: 2,
      open_count: 0,
      resolved_count: 2,
      latest_incident_at: '2026-08-03',
      categories: [
        { category: 'Flash', count: 1 },
        { category: 'Short Part', count: 1 },
      ],
      parts: [
        { part_number: '1093472-00-F', part_description: 'Housing', count: 1 },
        { part_number: '2045158-00-D', part_description: 'Cover, front', count: 1 },
      ],
      repeated_patterns: [],
      incidents: [
        {
          incident_code: 'QC-2011',
          created_at: '2026-05-19',
          status: 'RESOLVED',
          part_number: '1093472-00-F',
          part_description: 'Housing',
          job_number: 'J-44010',
          machine: 'IMM-3',
          shift_name: '2nd',
          categories: ['Flash'],
          problem: 'Light flash on the housing seam.',
          latest_action: { text: 'Seam vent cleaned and verified.', by: 'Ana Ruiz', at: '2026-05-19T18:00:00' },
          action_count: 1,
          media_count: 0,
          resolved_at: '2026-05-20',
        },
        {
          incident_code: 'QC-2044',
          created_at: '2026-08-03',
          status: 'RESOLVED',
          part_number: '2045158-00-D',
          part_description: 'Cover, front',
          job_number: 'J-45102',
          machine: 'IMM-12',
          shift_name: '2nd',
          categories: ['Short Part'],
          problem: 'Short shot on the first shots of the shift.',
          latest_action: { text: 'Confirmed the dry cycle with the operator.', by: 'Ana Ruiz', at: '2026-08-03T16:10:00' },
          action_count: 1,
          media_count: 1,
          resolved_at: '2026-08-04',
        },
      ],
      synced_at: '2026-11-25T06:00:00',
    },
  },
  {
    id: '2104',
    data: {
      employee_id: '2104',
      employee_name: 'Luis Ortega',
      incident_count: 3,
      open_count: 2,
      resolved_count: 1,
      latest_incident_at: '2026-07-01',
      categories: [
        { category: 'Packaging', count: 2 },
        { category: 'Short Part', count: 1 },
      ],
      parts: [
        { part_number: 'PKG-100', part_description: 'Ship carton', count: 2 },
        { part_number: 'SHORT-9', part_description: 'Knob', count: 1 },
      ],
      repeated_patterns: [
        { part_number: 'PKG-100', category: 'Packaging', count: 2 },
      ],
      incidents: [
        {
          incident_code: 'QC-3010',
          created_at: '2026-04-02',
          status: 'OPEN',
          part_number: 'PKG-100',
          part_description: 'Ship carton',
          job_number: 'J-42880',
          machine: 'Pack-2',
          shift_name: '1st',
          categories: ['Packaging'],
          problem: 'Carton label missing the lot code.',
          latest_action: null,
          action_count: 0,
          media_count: 1,
          resolved_at: null,
        },
        {
          incident_code: 'QC-3066',
          created_at: '2026-06-18',
          status: 'IN_PROGRESS',
          part_number: 'PKG-100',
          part_description: 'Ship carton',
          job_number: 'J-44661',
          machine: 'Pack-2',
          shift_name: '1st',
          categories: ['Packaging'],
          problem: 'Same carton left without a lot code.',
          latest_action: { text: 'Hold placed on the pallet.', by: 'Ana Ruiz', at: '2026-06-18T10:00:00' },
          action_count: 1,
          media_count: 2,
          resolved_at: null,
        },
        {
          incident_code: 'QC-3090',
          created_at: '2026-07-01',
          status: 'RESOLVED',
          part_number: 'SHORT-9',
          part_description: 'Knob',
          job_number: 'J-44800',
          machine: 'IMM-9',
          shift_name: '3rd',
          categories: ['Short Part'],
          problem: 'Knob short on the last cavity.',
          latest_action: { text: 'Cavity cleaned and the lot sorted.', by: 'Ana Ruiz', at: '2026-07-01T08:40:00' },
          action_count: 1,
          media_count: 0,
          resolved_at: '2026-07-02',
        },
      ],
      synced_at: '2026-11-25T06:00:00',
    },
  },
  {
    id: '4501',
    data: {
      employee_id: '4501',
      employee_name: 'Rosa Diaz',
      incident_count: 2,
      open_count: 1,
      resolved_count: 1,
      latest_incident_at: '2026-09-09',
      categories: [{ category: 'Warp / Deformation', count: 2 }],
      parts: [{ part_number: '1093472-00-F', part_description: 'Housing', count: 2 }],
      repeated_patterns: [
        { part_number: '1093472-00-F', category: 'Warp / Deformation', count: 2 },
      ],
      incidents: [
        {
          incident_code: 'QC-4102',
          created_at: '2026-04-16',
          status: 'RESOLVED',
          part_number: '1093472-00-F',
          part_description: 'Housing',
          job_number: 'J-43330',
          machine: 'IMM-3',
          shift_name: '1st',
          categories: ['Warp / Deformation'],
          problem: 'Housing bowed after a short cooling time.',
          latest_action: { text: 'Cooling time restored to the sheet.', by: 'Ana Ruiz', at: '2026-04-16T13:15:00' },
          action_count: 1,
          media_count: 1,
          resolved_at: '2026-04-17',
        },
        {
          incident_code: 'QC-4188',
          created_at: '2026-09-09',
          status: 'OPEN',
          part_number: '1093472-00-F',
          part_description: 'Housing',
          job_number: 'J-46002',
          machine: 'IMM-3',
          shift_name: '1st',
          categories: ['Warp / Deformation'],
          problem: 'Housing bowed again on the same tool.',
          latest_action: { text: 'Corrective action opened for the cooling fixture.', by: 'Ana Ruiz', at: '2026-09-09T09:05:00' },
          action_count: 2,
          media_count: 4,
          resolved_at: null,
        },
      ],
      synced_at: '2026-11-25T06:00:00',
    },
  },
];

const summaryDoc: Record<string, unknown> = {
  generated_at: '2026-11-25T05:58:00',
  synced_at: '2026-11-25T06:00:00',
  employee_count: 4,
  incident_count: 11,
  open_count: 5,
  repeat_employee_count: 3,
  categories: [
    { category: 'Flash', count: 3 },
    { category: 'Short Part', count: 3 },
    { category: 'Warp / Deformation', count: 3 },
    { category: 'Packaging', count: 2 },
  ],
  last_run_ok: true,
};

const fn135Docs: unknown[] = [
  {
    id: 'fn135-maria',
    recordId: 'FN135-20260818-MARIA',
    createdAt: '2026-08-18T14:05:00',
    trainerName: 'Jose Alvarez',
    documentNumber: 'FN-112',
    partNumber: '2045158-00-D',
    employees: [
      { id: '06876', name: 'Maria Carrera', passed: true, comments: 'Gate flash reviewed on the line.' },
      { id: '9999', name: 'Someone Else', passed: false, comments: 'Should not appear on Maria.' },
    ],
  },
  {
    id: 'fn135-other',
    recordId: 'FN135-OTHER',
    createdAt: '2026-01-02T08:00:00',
    trainerName: 'Jose Alvarez',
    documentNumber: 'FN-199',
    partNumber: 'NO-MATCH',
    employees: [{ id: '9999', name: 'Someone Else', passed: true, comments: '' }],
  },
];

export function fixtureQcEmployees(): QcEmployeeHistory[] {
  return qcDocs
    .map(doc => parseQcEmployee(doc.id, doc.data))
    .filter((employee): employee is QcEmployeeHistory => employee != null);
}

export function fixtureQcSummary(): QcSummary {
  const summary = parseQcSummary(summaryDoc);
  if (!summary) throw new Error('Fixture QC summary did not parse.');
  return summary;
}

export function fixtureFn135(): Record<string, Fn135Submission[]> {
  return {
    '6876': parseFn135ForEmployee(fn135Docs, '6876'),
    '6388': parseFn135ForEmployee(fn135Docs, '6388'),
    '2104': parseFn135ForEmployee(fn135Docs, '2104'),
    '4501': parseFn135ForEmployee(fn135Docs, '4501'),
  };
}

/** Dev-server only. Production builds never turn this on. */
export function isEmployeeProfileFixture(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('fixture') === 'employee-profile';
}
