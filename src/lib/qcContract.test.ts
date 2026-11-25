import { describe, expect, it } from 'vitest';
import { parseFn135ForEmployee } from './fn135Records';
import {
  calendarDay,
  formatQcStamp,
  hasRepeatPattern,
  parseQcEmployee,
  parseQcSummary,
  readQcDate,
} from './qcContract';

describe('readQcDate', () => {
  it('reads a calendar day, an ISO time, a Timestamp-like object, and toDate()', () => {
    expect(calendarDay(readQcDate('2026-09-15'))).toBe('2026-09-15');
    expect(readQcDate('2026-09-04T09:30:00')?.getHours()).toBe(9);
    expect(readQcDate(null)).toBeNull();
    expect(readQcDate('')).toBeNull();

    const seconds = Date.UTC(2026, 8, 15, 16, 0, 0) / 1000;
    expect(readQcDate({ seconds, nanoseconds: 0 })?.getTime()).toBe(seconds * 1000);
    expect(readQcDate({
      toDate: () => new Date(2026, 9, 22, 11, 5),
    })?.getDate()).toBe(22);
    expect(formatQcStamp(new Date(2026, 8, 15))).toBe('9/15/2026');
    expect(formatQcStamp(new Date(2026, 8, 4, 9, 30))).toBe('9/4/2026 9:30 AM');
    expect(formatQcStamp(null)).toBe('—');
  });
});

describe('parseQcEmployee', () => {
  it('canonicalizes the document id the same way as an FN-112 employee id', () => {
    const parsed = parseQcEmployee('06876', {
      employee_id: '6,876',
      employee_name: 'Maria Carrera',
      incident_count: '4',
      open_count: 2,
      resolved_count: 2,
      latest_incident_at: { seconds: Date.UTC(2026, 9, 22, 18, 0, 0) / 1000 },
      categories: [{ category: 'Flash', count: '2' }, { category: '', count: 1 }, 'nope'],
      parts: [{ part_number: '2045158-00-D', part_description: 'Cover', count: 2 }],
      repeated_patterns: [{ part_number: '2045158-00-D', category: 'Flash', count: 2 }],
      incidents: [
        {
          incident_code: 'QC-1102',
          created_at: '2026-09-03',
          status: 'open',
          part_number: '2045158-00-D',
          part_description: 'Cover',
          job_number: 'J-1',
          machine: 'IMM-12',
          shift_name: '1st',
          categories: ['Flash', ''],
          problem: 'Flash returned.',
          latest_action: { text: 'Retrain scheduled.', by: 'Ana Ruiz', at: '2026-09-04T09:30:00' },
          action_count: '2',
          media_count: 3,
          resolved_at: null,
        },
        'skip me',
      ],
      synced_at: '2026-11-25T06:00:00',
    });

    expect(parsed?.employeeId).toBe('6876');
    expect(parsed?.incidentCount).toBe(4);
    expect(parsed?.categories).toEqual([{ category: 'Flash', count: 2 }]);
    expect(parsed?.incidents).toHaveLength(1);
    expect(parsed?.incidents[0]).toMatchObject({
      incidentCode: 'QC-1102',
      status: 'OPEN',
      actionCount: 2,
      categories: ['Flash'],
      latestAction: { text: 'Retrain scheduled.', by: 'Ana Ruiz' },
    });
    expect(calendarDay(parsed?.incidents[0].createdAt ?? null)).toBe('2026-09-03');
    expect(hasRepeatPattern(parsed?.repeatedPatterns ?? [])).toBe(true);
  });

  it('returns null for a document with no employee id and tolerates a missing incident list', () => {
    expect(parseQcEmployee('', { employee_name: 'Nobody' })).toBeNull();
    expect(parseQcEmployee('  ', null)).toBeNull();
    const parsed = parseQcEmployee('42', { employee_name: 'Ada' });
    expect(parsed).toMatchObject({
      employeeId: '42',
      employeeName: 'Ada',
      incidentCount: 0,
      incidents: [],
      repeatedPatterns: [],
    });
    expect(hasRepeatPattern([])).toBe(false);
    expect(hasRepeatPattern([{ count: 1 }])).toBe(false);
  });
});

describe('parseQcSummary', () => {
  it('reads the sync summary and a failed run', () => {
    const summary = parseQcSummary({
      generated_at: '2026-11-25T05:58:00',
      synced_at: '2026-11-25T06:00:00',
      employee_count: 4,
      incident_count: '11',
      open_count: 5,
      repeat_employee_count: 3,
      categories: [{ category: 'Packaging', count: 2 }],
      last_run_ok: false,
    });
    expect(summary).toMatchObject({
      employeeCount: 4,
      incidentCount: 11,
      repeatEmployeeCount: 3,
      lastRunOk: false,
    });
    expect(summary?.syncedAt?.getHours()).toBe(6);
    expect(parseQcSummary(null)).toBeNull();
    expect(parseQcSummary({ last_run_ok: 'true' })?.lastRunOk).toBe(true);
  });
});

describe('parseFn135ForEmployee', () => {
  it('keeps only the matching employee and ignores the rest of a group submission', () => {
    const rows = parseFn135ForEmployee([
      {
        id: 'older',
        recordId: 'FN135-OLD',
        createdAt: '2026-01-02T08:00:00',
        documentNumber: 'FN-199',
        partNumber: 'NO-MATCH',
        trainerName: 'Jose Alvarez',
        employees: [{ id: '6876', passed: 'fail', comments: 'Earlier class.' }],
      },
      {
        recordId: 'FN135-20260818-MARIA',
        createdAt: '2026-08-18T14:05:00',
        documentNumber: 'FN-112',
        partNumber: '2045158-00-D',
        trainerName: 'Jose Alvarez',
        employees: [
          { id: '06876', passed: true, comments: 'Gate flash reviewed on the line.' },
          { id: '9999', passed: false, comments: 'Not Maria.' },
        ],
      },
    ], '6,876');

    expect(rows.map(row => row.recordId)).toEqual(['FN135-20260818-MARIA', 'FN135-OLD']);
    expect(rows[0]).toMatchObject({
      partNumber: '2045158-00-D',
      passed: true,
      comments: 'Gate flash reviewed on the line.',
    });
    expect(parseFn135ForEmployee(rows, '')).toEqual([]);
  });
});
