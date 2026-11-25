/**
 * Compare one employee's FN-112 part training with their QC incidents.
 *
 * This is the competence check behind IATF 16949 / ISO 9001 clause 7.2
 * (people are trained before the work) and clause 10.2 (a repeat after
 * training is a reason to look at corrective action).
 *
 * Dates are calendar days. Training counts as "before" only when the first
 * FN-112 date for that part is strictly earlier than the incident day.
 * A repeat is a later incident on the same part when an earlier incident
 * on that part already happened on or after that training date.
 */

import { formatTrainingDate, normalizePartNumber } from './partTraining';

export type TrainingLink = 'trained_before' | 'not_trained' | 'repeat_after_training';

export const TRAINING_LINK_LABEL: Record<TrainingLink, string> = {
  trained_before: 'Trained before incident',
  not_trained: 'Not trained on this part',
  repeat_after_training: 'Repeat after training',
};

export interface PartTrainingRef {
  partNumber: string;
  /** ISO yyyy-mm-dd */
  firstDate: string;
}

export interface IncidentRef {
  incidentCode: string;
  partNumber: string;
  /** ISO yyyy-mm-dd, or null when the incident has no usable date. */
  incidentDate: string | null;
}

export interface TrainingLinkResult {
  link: TrainingLink;
  label: string;
  detail: string;
  matchedPart: string | null;
  trainingFirstDate: string | null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function segments(part: string): string[] {
  return part.split(' / ').map(segment => segment.trim()).filter(segment => segment.length > 0);
}

/** True when the incident part and the training part share a part number. */
export function partNumbersMatch(incidentPart: string, trainingPart: string): boolean {
  const left = normalizePartNumber(incidentPart);
  const right = normalizePartNumber(trainingPart);
  if (!left || !right) return false;
  const leftParts = segments(left);
  const rightParts = segments(right);
  return leftParts.some(a => rightParts.some(b => a.toLowerCase() === b.toLowerCase()));
}

/** Earliest FN-112 first-date whose part matches the incident part. */
export function findEarliestTraining(
  incidentPart: string,
  training: readonly PartTrainingRef[],
): PartTrainingRef | null {
  let best: PartTrainingRef | null = null;
  for (const row of training) {
    if (!ISO_DAY.test(row.firstDate)) continue;
    if (!partNumbersMatch(incidentPart, row.partNumber)) continue;
    if (!best || row.firstDate < best.firstDate) best = row;
  }
  return best;
}

function linkResult(
  link: TrainingLink,
  matchedPart: string | null,
  trainingFirstDate: string | null,
  detail: string,
): TrainingLinkResult {
  return {
    link,
    label: TRAINING_LINK_LABEL[link],
    detail,
    matchedPart,
    trainingFirstDate,
  };
}

function dayLabel(iso: string): string {
  return formatTrainingDate(iso);
}

interface ResolvedIncident {
  incident: IncidentRef;
  match: PartTrainingRef | null;
  partLabel: string;
}

function priorIncident(incidents: readonly ResolvedIncident[], index: number): ResolvedIncident | null {
  const current = incidents[index];
  const trainedOn = current.match?.firstDate;
  const incidentDate = current.incident.incidentDate;
  if (!trainedOn || !incidentDate) return null;

  let prior: ResolvedIncident | null = null;
  for (let otherIndex = 0; otherIndex < incidents.length; otherIndex += 1) {
    if (otherIndex === index) continue;
    const other = incidents[otherIndex];
    const otherDate = other.incident.incidentDate;
    if (!otherDate || otherDate >= incidentDate || otherDate < trainedOn) continue;
    if (!partNumbersMatch(current.incident.partNumber, other.incident.partNumber)) continue;
    if (!prior || (otherDate > (prior.incident.incidentDate ?? ''))) prior = other;
  }
  return prior;
}

/**
 * Classify every incident for one employee, in the same order they were given.
 */
export function classifyIncidents(
  incidents: readonly IncidentRef[],
  training: readonly PartTrainingRef[],
): TrainingLinkResult[] {
  const resolved: ResolvedIncident[] = incidents.map(incident => ({
    incident,
    match: findEarliestTraining(incident.partNumber, training),
    partLabel: normalizePartNumber(incident.partNumber) ?? '',
  }));

  return resolved.map((current, index) => {
    const { incident, match, partLabel } = current;

    if (!partLabel) {
      return linkResult(
        'not_trained',
        null,
        null,
        'This incident has no part number, so it cannot be matched to FN-112.',
      );
    }
    if (!match) {
      return linkResult(
        'not_trained',
        null,
        null,
        `No FN-112 training matches part ${partLabel}.`,
      );
    }

    const trained = dayLabel(match.firstDate);
    const samePartNote = partLabel.toLowerCase() === match.partNumber.toLowerCase()
      ? ''
      : ` Matched to FN-112 part ${match.partNumber}.`;

    if (!incident.incidentDate) {
      return linkResult(
        'not_trained',
        match.partNumber,
        match.firstDate,
        `FN-112 training on ${match.partNumber} starts ${trained}, but this incident has no date, so it cannot be confirmed as before the incident.${samePartNote}`,
      );
    }

    if (match.firstDate > incident.incidentDate) {
      return linkResult(
        'not_trained',
        match.partNumber,
        match.firstDate,
        `FN-112 training on ${match.partNumber} starts ${trained}, which is after this incident (${dayLabel(incident.incidentDate)}).${samePartNote}`,
      );
    }

    if (match.firstDate === incident.incidentDate) {
      return linkResult(
        'not_trained',
        match.partNumber,
        match.firstDate,
        `FN-112 training on ${match.partNumber} is dated ${trained}, the same day as the incident, so it is not counted as before the incident.${samePartNote}`,
      );
    }

    const prior = priorIncident(resolved, index);
    if (prior) {
      const priorDate = prior.incident.incidentDate ? dayLabel(prior.incident.incidentDate) : 'an unknown date';
      const priorCode = prior.incident.incidentCode || 'an earlier incident';
      return linkResult(
        'repeat_after_training',
        match.partNumber,
        match.firstDate,
        `FN-112 training on ${match.partNumber} started ${trained}. This incident is a repeat on that part after ${priorCode} on ${priorDate}.${samePartNote}`,
      );
    }

    return linkResult(
      'trained_before',
      match.partNumber,
      match.firstDate,
      `FN-112 training on ${match.partNumber} started ${trained}, before this incident. No earlier QC incident on this part happened after that training.${samePartNote}`,
    );
  });
}

export function countLinks(results: readonly TrainingLinkResult[]): Record<TrainingLink, number> {
  return {
    trained_before: results.filter(result => result.link === 'trained_before').length,
    not_trained: results.filter(result => result.link === 'not_trained').length,
    repeat_after_training: results.filter(result => result.link === 'repeat_after_training').length,
  };
}
