/**
 * Local-calendar date helpers.
 *
 * docs/data-model.md requires the expense date to be "stored in a consistent
 * format" and defines every derived period — today, week, month — in terms of
 * the *local* calendar. That rules out `toISOString()`: it converts to UTC
 * first, so an expense logged at 00:30 IST would be filed under the previous
 * day, and totals would silently disagree with the user's own diary.
 *
 * So dates move around as local `Date` objects and are keyed as `YYYY-MM-DD`
 * derived from local getters. No timezone library is needed for that, and none
 * is added.
 */

/** Weekday initials, Monday first. */
export const WEEKDAY_INITIALS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/**
 * Cells in a month grid: six Monday-first weeks.
 *
 * Fixed at 42 rather than trimmed to the weeks actually used, so the calendar's
 * height never changes between months and the modal does not jump.
 */
export const MONTH_GRID_CELLS = 42;

/**
 * `YYYY-MM-DD` in local time.
 *
 * This is the storage shape for `expenses.date` in docs/data-model.md.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Inverse of `toDateKey`. Returns local midnight for the given day.
 */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);

  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * `YYYY-MM` for the calendar month containing `date`, local time.
 *
 * The storage shape for `budgets.month` (docs/data-model.md): one budget per
 * calendar month, like the expense `date` key but at coarser resolution.
 */
export function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');

  return `${year}-${month}`;
}

/** Whether `key` is a real month identifier in `YYYY-MM` form. */
export function isValidMonthKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

/**
 * Whether `key` is a real local calendar date in `YYYY-MM-DD` form.
 *
 * Round-trips through `fromDateKey` instead of only testing the shape, because
 * the shape alone accepts dates that do not exist: '2026-02-30' matches
 * `\d{4}-\d{2}-\d{2}` but parses to 2 March, so re-encoding it gives a different
 * key. The database guards the same invariant with a CHECK constraint; this is
 * the version that can explain *why* an insert was rejected.
 */
export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return false;
  }

  return toDateKey(fromDateKey(key)) === key;
}

/** Local midnight, so comparisons never trip over a time of day. */
export function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  return normalized;
}

/**
 * Shift by whole days.
 *
 * Uses `setDate` rather than adding milliseconds so the result is always the
 * same wall-clock time on the target day, across a daylight-saving boundary.
 */
export function addDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);

  return shifted;
}

/** Shift by whole months, clamping to the last valid day. */
export function addMonths(date: Date, months: number): Date {
  const shifted = new Date(date.getFullYear(), date.getMonth() + months, 1);

  return shifted;
}

export function isSameDateKey(a: string, b: string): boolean {
  return a === b;
}

/** Weekday index with Monday as 0, matching docs/data-model.md's week boundary. */
export function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Six Monday-first weeks covering the month `month` falls in.
 *
 * Padded with the neighbouring months' days so the grid is always full; the
 * caller decides whether to dim or hide the out-of-month cells.
 */
export function buildMonthGrid(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -mondayFirstIndex(firstOfMonth));

  return Array.from({ length: MONTH_GRID_CELLS }, (_, index) =>
    addDays(gridStart, index),
  );
}

/**
 * Formatters are hoisted to module scope — `Intl.DateTimeFormat` construction is
 * expensive enough that doing it per render shows up in a scrolling list
 * (vercel-react-native-skills/rules/js-hoist-intl.md).
 */
const shortDayFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
});

const fullDateFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const monthYearFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
});

/** "3 Oct" — for the quick-pick date chips. */
export function formatShortDay(date: Date): string {
  return shortDayFormatter.format(date);
}

/** "Tuesday, 6 October 2026" — the unambiguous statement of what was chosen. */
export function formatFullDate(date: Date): string {
  return fullDateFormatter.format(date);
}

/** "October 2026" — the calendar's title. */
export function formatMonthYear(date: Date): string {
  return monthYearFormatter.format(date);
}

/**
 * The dates most expenses are actually logged against.
 *
 * Today and yesterday first, then the preceding week as short dates. This is
 * the tap-minimising path: the overwhelming majority of entries land on one of
 * these, so they are one tap away and the full calendar stays out of the way.
 */
export function buildQuickDateOptions(today: Date): { key: string; label: string }[] {
  const options = [
    { key: toDateKey(today), label: 'Today' },
    { key: toDateKey(addDays(today, -1)), label: 'Yesterday' },
  ];

  for (let daysBack = 2; daysBack <= 7; daysBack += 1) {
    const date = addDays(today, -daysBack);
    options.push({ key: toDateKey(date), label: formatShortDay(date) });
  }

  return options;
}