/**
 * Turning "now" into the ranges the dashboard counts.
 *
 * docs/data-model.md defines today, this week and this month, and pins the week
 * boundary to Monday. Every derived metric in the app must resolve periods the
 * same way, so the arithmetic lives here once instead of in each query.
 *
 * All of it is local-calendar arithmetic. `expenses.date` is stored as a local
 * `YYYY-MM-DD` key (see utils/dates.ts), so a period is just a pair of date keys
 * and the database can compare them as text.
 */

import { addDays, mondayFirstIndex, startOfDay, toDateKey } from '@/utils/dates';

/** An inclusive span of local dates, as stored keys. */
export type DateRange = {
  fromKey: string;
  toKey: string;
};

export type DashboardPeriods = {
  today: DateRange;
  week: DateRange;
  month: DateRange;
};

/**
 * Monday of the week containing `date`, at local midnight.
 *
 * `mondayFirstIndex` already counts Monday as 0, so subtracting that offset
 * lands on the Monday. The result is always a *past or present* Monday, never
 * the following one — which is what makes a partially-elapsed week count as a
 * week rather than as seven days including next Tuesday.
 */
export function startOfWeek(date: Date): Date {
  const normalized = startOfDay(date);

  return addDays(normalized, -mondayFirstIndex(normalized));
}

/** Sunday of the week containing `date`, at local midnight. */
export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

/**
 * Last day of the month containing `date`.
 *
 * Day `0` of the next month is the last day of this one, which sidesteps a leap
 * year table entirely.
 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * The three ranges the dashboard reports, relative to `reference`.
 *
 * @param reference "now". A parameter rather than a bare `new Date()` so the
 * boundaries can be tested, and so a caller that already has a clock reading does
 * not get a second one that is a few milliseconds later — a month boundary
 * crossed between the two would make the totals disagree with themselves.
 */
export function resolveDashboardPeriods(reference: Date = new Date()): DashboardPeriods {
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);

  return {
    today: { fromKey: toDateKey(reference), toKey: toDateKey(reference) },
    week: { fromKey: toDateKey(startOfWeek(reference)), toKey: toDateKey(endOfWeek(reference)) },
    month: { fromKey: toDateKey(monthStart), toKey: toDateKey(endOfMonth(reference)) },
  };
}