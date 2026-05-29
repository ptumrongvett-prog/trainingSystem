/**
 * dateUtils.ts — Date manipulation utilities for training compliance.
 * All date parsing, comparison, grouping logic lives here.
 */

/** Parse AppSheet date strings like "12/31/2025", "1/30/2026", "4/27/2026 10:13:00" */
export function parseAppSheetDate(str: string | null | undefined): Date | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Try "M/D/YYYY H:M:S" or "M/D/YYYY"
  const parts = trimmed.split(' ');
  const dateParts = parts[0].split('/');
  if (dateParts.length !== 3) return null;

  const month = parseInt(dateParts[0], 10) - 1;
  const day   = parseInt(dateParts[1], 10);
  const year  = parseInt(dateParts[2], 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  let hours = 0, minutes = 0, seconds = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(':');
    hours   = parseInt(timeParts[0], 10) || 0;
    minutes = parseInt(timeParts[1], 10) || 0;
    seconds = parseInt(timeParts[2], 10) || 0;
  }

  const d = new Date(year, month, day, hours, minutes, seconds);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Check if a date is within N days from today */
export function isWithinDays(date: Date | null, days: number, today: Date = new Date()): boolean {
  if (!date) return false;
  const diff = date.getTime() - today.getTime();
  const dayMs = 86400000;
  return diff >= 0 && diff <= days * dayMs;
}

/** Check if a date is in the past */
export function isPast(date: Date | null, today: Date = new Date()): boolean {
  if (!date) return false;
  return date.getTime() < startOfDay(today).getTime();
}

/** Get start of day (midnight) */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Get week range (Monday–Sunday) containing date */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Get month range */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Group items by ISO week key (e.g. "2026-W04") */
export function groupByWeek<T>(items: T[], dateField: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const d = parseAppSheetDate(item[dateField] as string);
    if (!d) continue;
    const key = getISOWeekKey(d);
    const arr = map.get(key) || [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

/** Group items by month key (e.g. "2026-01") */
export function groupByMonth<T>(items: T[], dateField: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const d = parseAppSheetDate(item[dateField] as string);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const arr = map.get(key) || [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

/** Format date for display */
export function formatDate(date: Date | string | null, locale = 'en-US'): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format date+time for display */
export function formatDateTime(date: Date | string | null, locale = 'en-US'): string {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleString(locale, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** Days since a date */
export function daysSince(date: Date | null, today: Date = new Date()): number {
  if (!date) return Infinity;
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

/** Days until a date */
export function daysUntil(date: Date | null, today: Date = new Date()): number {
  if (!date) return Infinity;
  return Math.floor((date.getTime() - today.getTime()) / 86400000);
}

/** Get ISO week key like "2026-W04" */
function getISOWeekKey(d: Date): string {
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Check if date falls within a range */
export function isInRange(date: Date | null, start: Date | null, end: Date | null): boolean {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}
