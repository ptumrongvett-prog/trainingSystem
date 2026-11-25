import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ASSIGNMENTS,
  FIXTURE_DIRECTORY,
  FIXTURE_TODAY,
  FIXTURE_TOPIC_NAMES,
  fixtureFn135,
  fixturePartEmployees,
  fixtureQcEmployees,
  fixtureQcSummary,
} from '../data/employeeProfileFixture';
import { Role } from '../types';
import { ComplianceStatus } from '../types';
import {
  assembleEmployeeProfile,
  buildOverviewRows,
  filterOverview,
  matchesEmployeeQuery,
  sortOverview,
} from './employeeProfile';
import { canView, getAccessibleSections } from './roles';

const topicName = (id: string) => FIXTURE_TOPIC_NAMES[id] || id;

function mariaProfile() {
  const parts = fixturePartEmployees();
  const qc = fixtureQcEmployees();
  return assembleEmployeeProfile({
    empId: '6,876',
    partEmployee: parts.find(employee => employee.empId === '6876') ?? null,
    directory: FIXTURE_DIRECTORY,
    assignments: FIXTURE_ASSIGNMENTS,
    topicName,
    qc: qc.find(employee => employee.employeeId === '6876') ?? null,
    today: FIXTURE_TODAY,
  });
}

describe('fixture employee profile', () => {
  it('links Maria Carrera’s QC incidents to FN-112 training and topic status', () => {
    const profile = mariaProfile();

    expect(profile).toMatchObject({
      empId: '6876',
      employeeName: 'Maria Carrera',
      active: true,
      department: 'Operators',
      shift: '1st',
      directoryFound: true,
    });
    expect(profile.parts.map(part => [part.partNumber, part.entryCount, part.firstDate, part.latestDate])).toEqual([
      ['330355T', 2, '2025-11-04', '2026-01-20'],
      ['2045158-00-D', 4, '2026-06-02', '2026-08-18'],
    ]);
    expect(profile.topics.map(topic => [topic.topicName, topic.status])).toEqual([
      ['Machine Operation Basics', ComplianceStatus.OVERDUE],
      ['Chemical Handling & SDS', ComplianceStatus.PENDING],
      ['Quality Standards & ISO', ComplianceStatus.COMPLETED],
    ]);
    expect(profile.incidents.map(item => [item.incident.incidentCode, item.link.label])).toEqual([
      ['QC-1044', 'Trained before incident'],
      ['QC-1102', 'Repeat after training'],
      ['QC-0988', 'Not trained on this part'],
      ['QC-1155', 'Trained before incident'],
    ]);
    expect(profile.linkCounts).toEqual({
      trained_before: 2,
      not_trained: 1,
      repeat_after_training: 1,
    });
    expect(fixtureFn135()['6876']).toHaveLength(1);
    expect(fixtureFn135()['6876'][0].recordId).toBe('FN135-20260818-MARIA');
    expect(fixtureQcSummary()).toMatchObject({
      employeeCount: 4,
      incidentCount: 11,
      lastRunOk: true,
    });
  });

  it('keeps an employee with QC problems and no matching part as not trained', () => {
    const luis = assembleEmployeeProfile({
      empId: '2104',
      partEmployee: fixturePartEmployees().find(employee => employee.empId === '2104') ?? null,
      directory: FIXTURE_DIRECTORY,
      assignments: FIXTURE_ASSIGNMENTS,
      topicName,
      qc: fixtureQcEmployees().find(employee => employee.employeeId === '2104') ?? null,
      today: FIXTURE_TODAY,
    });

    expect(luis.employeeName).toBe('Luis Ortega');
    expect(luis.active).toBe(false);
    expect(luis.directoryFound).toBe(false);
    expect(luis.topics).toEqual([]);
    expect(luis.linkCounts.not_trained).toBe(3);
    expect(luis.linkCounts.repeat_after_training).toBe(0);
    expect(luis.qc?.repeatedPatterns[0]).toMatchObject({ partNumber: 'PKG-100', count: 2 });
  });
});

describe('QC overview list', () => {
  const rows = buildOverviewRows({
    qcEmployees: fixtureQcEmployees(),
    partEmployees: fixturePartEmployees(),
    directory: FIXTURE_DIRECTORY,
    assignments: FIXTURE_ASSIGNMENTS,
    topicName,
    trainingLoaded: true,
    today: FIXTURE_TODAY,
  });

  it('sorts by incident count, and puts repeat employees first when asked', () => {
    const byIncidents = sortOverview(filterOverview(rows, '', true), 'incidents').map(row => row.empId);
    const byRepeat = sortOverview(filterOverview(rows, '', true), 'repeat').map(row => row.empId);
    expect(byIncidents).toEqual(['6876', '2104', '6388', '4501']);
    expect(byRepeat).toEqual(['6876', '2104', '4501', '6388']);
    expect(rows.find(row => row.empId === '6388')?.repeat).toBe(false);
    expect(rows.find(row => row.empId === '6876')?.linkCounts).toEqual({
      trained_before: 2,
      not_trained: 1,
      repeat_after_training: 1,
    });
  });

  it('searches by a comma-formatted id or a partial name, including people with no QC record', () => {
    expect(matchesEmployeeQuery('6876', 'Maria Carrera', '6,876')).toBe(true);
    expect(filterOverview(rows, 'ortega', true).map(row => row.empId)).toEqual(['2104']);
    const directoryOnly = filterOverview(rows, 'pirir', false).map(row => row.empId);
    expect(directoryOnly).toContain('6388');
    expect(filterOverview(rows, '', true).every(row => row.hasQc)).toBe(true);
  });

  it('does not invent training flags while FN-112 is still loading', () => {
    const loading = buildOverviewRows({
      qcEmployees: fixtureQcEmployees(),
      partEmployees: [],
      directory: FIXTURE_DIRECTORY,
      assignments: FIXTURE_ASSIGNMENTS,
      topicName,
      trainingLoaded: false,
      today: FIXTURE_TODAY,
    });
    expect(loading.find(row => row.empId === '6876')?.linkCounts).toBeNull();
  });
});

describe('employee profile access', () => {
  it('sits with Part Training for supervisors and admins only', () => {
    expect(canView(Role.ADMIN, 'employeeProfile')).toBe(true);
    expect(canView(Role.SUPERVISOR, 'employeeProfile')).toBe(true);
    expect(canView(Role.VIEWER, 'employeeProfile')).toBe(false);
    expect(canView(Role.EMPLOYEE, 'employeeProfile')).toBe(false);
    const sections = getAccessibleSections(Role.SUPERVISOR);
    expect(sections.indexOf('employeeProfile')).toBe(sections.indexOf('partTraining') + 1);
  });
});
