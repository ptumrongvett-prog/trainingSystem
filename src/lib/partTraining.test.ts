import { describe, expect, it } from 'vitest';
import {
  aggregatePartTraining,
  formatTrainingDate,
  normalizeEmployeeId,
  normalizePartNumber,
  parseTrainingDate,
  type RawTrainingRow,
} from './partTraining';

/** Wednesday, Nov 25, 2026 — the date the report rules were checked against. */
const TODAY = new Date(2026, 10, 25);

function row(partial: Partial<RawTrainingRow> & Pick<RawTrainingRow, 'part' | 'empId' | 'trainingDate'>): RawTrainingRow {
  return {
    empName: partial.empName ?? '',
    part: partial.part,
    empId: partial.empId,
    trainingDate: partial.trainingDate,
  };
}

describe('normalizeEmployeeId', () => {
  it('trims, removes thousands commas, and canonicalizes numeric text', () => {
    expect(normalizeEmployeeId('1,400')).toBe('1400');
    expect(normalizeEmployeeId(' 6876 ')).toBe('6876');
    expect(normalizeEmployeeId('06876')).toBe('6876');
    expect(normalizeEmployeeId('5,426')).toBe('5426');
    expect(normalizeEmployeeId('6876.0')).toBe('6876');
  });

  it('returns null for blank ids and keeps non-numeric ids', () => {
    expect(normalizeEmployeeId('')).toBeNull();
    expect(normalizeEmployeeId('   ')).toBeNull();
    expect(normalizeEmployeeId(null)).toBeNull();
    expect(normalizeEmployeeId('TEMP-12')).toBe('TEMP-12');
  });
});

describe('normalizePartNumber', () => {
  it('trims spaces and keeps a multi-line cell as one part', () => {
    expect(normalizePartNumber(' 2045158-00-D ')).toBe('2045158-00-D');
    expect(normalizePartNumber('1035201-00-F\n1035202-00-F')).toBe('1035201-00-F / 1035202-00-F');
    expect(normalizePartNumber('  A \r\n B  ')).toBe('A / B');
    expect(normalizePartNumber('   ')).toBeNull();
    expect(normalizePartNumber(null)).toBeNull();
  });
});

describe('parseTrainingDate', () => {
  it('accepts real dates from 2015-01-01 through today', () => {
    expect(parseTrainingDate('1/1/2015', TODAY)?.getFullYear()).toBe(2015);
    expect(parseTrainingDate('11/23/2026', TODAY)?.getDate()).toBe(23);
    expect(parseTrainingDate('11/25/2026', TODAY)?.getDate()).toBe(25);
    expect(parseTrainingDate('4/27/2026 10:13:00', TODAY)?.getDate()).toBe(27);
    expect(parseTrainingDate('5/3/23', TODAY)?.getFullYear()).toBe(2023);
    expect(parseTrainingDate('2026-04-13', TODAY)?.getMonth()).toBe(3);
  });

  it('rejects blank, text, impossible, typo, and out-of-range dates', () => {
    expect(parseTrainingDate('', TODAY)).toBeNull();
    expect(parseTrainingDate('N/A', TODAY)).toBeNull();
    expect(parseTrainingDate('6/21', TODAY)).toBeNull();
    expect(parseTrainingDate('2/31/2020', TODAY)).toBeNull();
    expect(parseTrainingDate('12/31/2014', TODAY)).toBeNull();
    expect(parseTrainingDate('11/26/2026', TODAY)).toBeNull();
    expect(parseTrainingDate('1/28/2028', TODAY)).toBeNull();
    expect(parseTrainingDate('10/24/0223', TODAY)).toBeNull();
    expect(parseTrainingDate('5/1/20223', TODAY)).toBeNull();
    expect(parseTrainingDate('9/20/22023', TODAY)).toBeNull();
  });
});

describe('aggregatePartTraining', () => {
  it('builds one pair per employee and part, with the sanity-check examples', () => {
    const maria = Array.from({ length: 9 }, () => row({
      part: ' 2045158-00-D ',
      empId: '6876',
      empName: 'MARIA FROM LOG',
      trainingDate: '11/23/2026',
    }));
    const rows: RawTrainingRow[] = [
      ...maria,
      row({ part: '2045158-00-D', empId: '6,876', empName: 'ignored', trainingDate: 'not a date' }),
      row({ part: '1093472-00-F', empId: '6388', empName: 'MIGUEL PIRIR', trainingDate: '11/23/2026' }),
      row({ part: '330355T', empId: '6388', empName: 'old name', trainingDate: '8/19/2025' }),
      row({ part: '330355T', empId: '6,388', empName: 'Miguel from log', trainingDate: '8/20/2025' }),
      row({ part: '1035201-00-F\n1035202-00-F', empId: '6388', empName: 'Miguel', trainingDate: '8/20/2025' }),
      row({ part: '', empId: '6388', empName: 'Miguel', trainingDate: '8/20/2025' }),
      row({ part: 'NO-EMP', empId: ' ', empName: 'Nobody', trainingDate: '8/20/2025' }),
      row({ part: 'OLD', empId: '100', empName: 'Early', trainingDate: '12/31/2014' }),
      row({ part: 'FUTURE', empId: '100', empName: 'Future', trainingDate: '1/28/2028' }),
      row({ part: '999-A', empId: '999', empName: 'Nine', trainingDate: '1/2/2020' }),
      row({ part: '1000-A', empId: '1,000', empName: 'Thousand', trainingDate: '6/1/2021' }),
    ];

    const active = new Map<string, string>([
      ['6388', 'Miguel Pirir'],
      ['6876', 'Maria Carrera'],
    ]);
    const report = aggregatePartTraining(rows, active, TODAY);

    const mariaPair = report.pairs.find(p => p.empId === '6876' && p.partNumber === '2045158-00-D');
    expect(mariaPair).toMatchObject({
      entryCount: 9,
      latestDate: '2026-11-23',
      firstDate: '2026-11-23',
      employeeName: 'Maria Carrera',
      active: true,
    });

    const miguel = report.employees.find(e => e.empId === '6388');
    expect(miguel).toMatchObject({
      employeeName: 'Miguel Pirir',
      active: true,
      partCount: 3,
    });
    expect(miguel?.parts.map(p => p.partNumber)).toEqual([
      '330355T',
      '1035201-00-F / 1035202-00-F',
      '1093472-00-F',
    ]);
    expect(miguel?.parts.find(p => p.partNumber === '330355T')).toMatchObject({
      entryCount: 2,
      firstDate: '2025-08-19',
      latestDate: '2025-08-20',
      employeeName: 'Miguel Pirir',
    });

    expect(report.pairs.some(p => p.partNumber === 'OLD' || p.partNumber === 'FUTURE' || p.partNumber === 'NO-EMP')).toBe(false);
    expect(report.pairs.map(p => p.empId)).toEqual(['999', '1000', '6388', '6388', '6388', '6876']);
    expect(formatTrainingDate('2026-11-23')).toBe('11/23/2026');
    expect(report.countedRows).toBe(9 + 1 + 2 + 1 + 1 + 1);
    expect(report.skippedRows).toBe(rows.length - report.countedRows);
  });

  it('uses the latest log name for employees who are not on the Employee tab', () => {
    const report = aggregatePartTraining([
      row({ part: 'AAA', empId: '42', empName: 'First Name', trainingDate: '1/1/2020' }),
      row({ part: 'AAA', empId: '42', empName: 'Latest Name', trainingDate: '3/3/2024' }),
      row({ part: 'BBB', empId: '42', empName: '', trainingDate: '6/6/2024' }),
      row({ part: 'BBB', empId: '42', empName: '   ', trainingDate: '1/1/2016' }),
    ], new Map(), TODAY);

    expect(report.employees).toHaveLength(1);
    expect(report.employees[0]).toMatchObject({
      empId: '42',
      active: false,
      employeeName: 'Latest Name',
      partCount: 2,
    });
    expect(report.employees[0].parts.find(p => p.partNumber === 'BBB')?.employeeName).toBe('Latest Name');
  });
});
