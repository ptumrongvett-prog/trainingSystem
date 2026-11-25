import { describe, expect, it } from 'vitest';
import {
  TRAINING_LINK_LABEL,
  classifyIncidents,
  countLinks,
  partNumbersMatch,
  type IncidentRef,
  type PartTrainingRef,
} from './trainingEffectiveness';

function incident(partNumber: string, incidentDate: string | null, incidentCode = 'QC-1'): IncidentRef {
  return { incidentCode, partNumber, incidentDate };
}

function trained(partNumber: string, firstDate: string): PartTrainingRef {
  return { partNumber, firstDate };
}

describe('partNumbersMatch', () => {
  it('matches a trimmed part, a different case, and one piece of a multi-line part', () => {
    expect(partNumbersMatch(' 2045158-00-D ', '2045158-00-D')).toBe(true);
    expect(partNumbersMatch('2045158-00-d', '2045158-00-D')).toBe(true);
    expect(partNumbersMatch('1035202-00-F', '1035201-00-F / 1035202-00-F')).toBe(true);
    expect(partNumbersMatch('1035201-00-F / 1035202-00-F', '1035202-00-F')).toBe(true);
    expect(partNumbersMatch('PKG-100', 'SHORT-9')).toBe(false);
    expect(partNumbersMatch('   ', 'PKG-100')).toBe(false);
  });
});

describe('classifyIncidents', () => {
  const cover = [trained('2045158-00-D', '2026-06-02')];

  it('flags training strictly before the incident, and a later incident on that part as a repeat', () => {
    const results = classifyIncidents([
      incident('2045158-00-D', '2026-07-10', 'QC-1044'),
      incident('2045158-00-D', '2026-09-03', 'QC-1102'),
    ], cover);

    expect(results.map(result => result.link)).toEqual(['trained_before', 'repeat_after_training']);
    expect(results[0].label).toBe(TRAINING_LINK_LABEL.trained_before);
    expect(results[0].detail).toContain('started 6/2/2026, before this incident');
    expect(results[1].label).toBe('Repeat after training');
    expect(results[1].detail).toContain('after QC-1044 on 7/10/2026');
    expect(countLinks(results)).toEqual({
      trained_before: 1,
      not_trained: 0,
      repeat_after_training: 1,
    });
  });

  it('does not treat an incident from before training as the start of a repeat', () => {
    const results = classifyIncidents([
      incident('2045158-00-D', '2026-05-01', 'QC-EARLY'),
      incident('2045158-00-D', '2026-07-01', 'QC-LATER'),
    ], cover);

    expect(results.map(result => result.link)).toEqual(['not_trained', 'trained_before']);
    expect(results[0].detail).toContain('which is after this incident (5/1/2026)');
    expect(results[1].detail).toContain('No earlier QC incident on this part happened after that training');
  });

  it('does not count same-day training as before the incident', () => {
    const [result] = classifyIncidents([
      incident('2045158-00-D', '2026-06-02', 'QC-SAME'),
    ], cover);

    expect(result.link).toBe('not_trained');
    expect(result.label).toBe('Not trained on this part');
    expect(result.detail).toContain('the same day as the incident');
  });

  it('says not trained when the part was never on FN-112, the part is blank, or the incident has no date', () => {
    const results = classifyIncidents([
      incident('8801001-00-B', '2026-05-12', 'QC-0988'),
      incident('   ', '2026-05-12', 'QC-BLANK'),
      incident('2045158-00-D', null, 'QC-NODATE'),
    ], cover);

    expect(results.map(result => result.link)).toEqual(['not_trained', 'not_trained', 'not_trained']);
    expect(results[0].detail).toBe('No FN-112 training matches part 8801001-00-B.');
    expect(results[1].detail).toContain('no part number');
    expect(results[2].detail).toContain('no date');
    expect(results[2].trainingFirstDate).toBe('2026-06-02');
  });

  it('uses the earliest matching FN-112 row, including one part inside a combined cell', () => {
    const training = [
      trained('1035201-00-F / 1035202-00-F', '2026-04-01'),
      trained('1035202-00-F', '2026-01-15'),
    ];
    const [result] = classifyIncidents([
      incident('1035202-00-F', '2026-03-01', 'QC-PART'),
    ], training);

    expect(result.link).toBe('trained_before');
    expect(result.matchedPart).toBe('1035202-00-F');
    expect(result.trainingFirstDate).toBe('2026-01-15');
  });

  it('does not call two different parts a repeat just because they were trained on one combined row', () => {
    const training = [trained('A / B', '2026-01-01')];
    const results = classifyIncidents([
      incident('A', '2026-03-01', 'QC-A'),
      incident('B', '2026-04-01', 'QC-B'),
    ], training);

    expect(results.map(result => result.link)).toEqual(['trained_before', 'trained_before']);
    expect(results[1].detail).toContain('Matched to FN-112 part A / B');
  });

  it('flags a second incident on one piece of a combined part as a repeat after training', () => {
    const training = [trained('A / B', '2026-01-01')];
    const results = classifyIncidents([
      incident('B', '2026-03-01', 'QC-B1'),
      incident('B', '2026-05-01', 'QC-B2'),
    ], training);

    expect(results.map(result => result.link)).toEqual(['trained_before', 'repeat_after_training']);
    expect(results[1].detail).toContain('QC-B1 on 3/1/2026');
  });
});
