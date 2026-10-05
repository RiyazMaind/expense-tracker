import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  endOfMonth,
  endOfWeek,
  resolveDashboardPeriods,
  startOfWeek,
} from '@/utils/calculations';
import { toDateKey } from '@/utils/dates';

/**
 * Every date here is constructed from local parts (`new Date(2026, 9, 6)`), never
 * from an ISO string, so the tests mean the same thing in every timezone the
 * suite runs in. 6 October 2026 is a Tuesday, which puts it in the middle of a
 * week and exposes both of its boundaries.
 */
describe('startOfWeek', () => {
  it('returns the same day when that day is Monday', () => {
    // Monday 5 October 2026
    assert.equal(toDateKey(startOfWeek(new Date(2026, 9, 5))), '2026-10-05');
  });

  it('steps back to Monday from the middle of the week', () => {
    assert.equal(toDateKey(startOfWeek(new Date(2026, 9, 6))), '2026-10-05');
    assert.equal(toDateKey(startOfWeek(new Date(2026, 9, 8))), '2026-10-05');
  });

  it('steps back six days from Sunday, not forward one', () => {
    // Sunday 11 October 2026 belongs to the week that began on the 5th.
    assert.equal(toDateKey(startOfWeek(new Date(2026, 9, 11))), '2026-10-05');
  });
});

describe('endOfWeek', () => {
  it('closes the week on Sunday', () => {
    assert.equal(toDateKey(endOfWeek(new Date(2026, 9, 5))), '2026-10-11');
    assert.equal(toDateKey(endOfWeek(new Date(2026, 9, 11))), '2026-10-11');
  });
});

describe('endOfMonth', () => {
  it('returns the last day of a 31-day month', () => {
    assert.equal(toDateKey(endOfMonth(new Date(2026, 9, 15))), '2026-10-31');
  });

  it('returns the last day of a 30-day month', () => {
    assert.equal(toDateKey(endOfMonth(new Date(2026, 3, 15))), '2026-04-30');
  });

  it('knows February has 28 days in a common year', () => {
    assert.equal(toDateKey(endOfMonth(new Date(2026, 1, 15))), '2026-02-28');
  });

  it('knows February has 29 days in a leap year', () => {
    assert.equal(toDateKey(endOfMonth(new Date(2028, 1, 15))), '2028-02-29');
  });

  it('crosses the year boundary without wrapping', () => {
    // December resolves inside 2026 even though the implementation builds
    // "month + 1" first, which is January 2027 before the day-0 step.
    assert.equal(toDateKey(endOfMonth(new Date(2026, 11, 15))), '2026-12-31');

    // And a January 2027 reading stays in 2027, rather than being pinned to the
    // previous December by a rollover that forgot to advance the year.
    assert.equal(toDateKey(endOfMonth(new Date(2027, 0, 15))), '2027-01-31');
  });
});

describe('resolveDashboardPeriods', () => {
  it('makes today a single day', () => {
    const periods = resolveDashboardPeriods(new Date(2026, 9, 6));

    assert.deepEqual(periods.today, { fromKey: '2026-10-06', toKey: '2026-10-06' });
  });

  it('runs the week Monday to Sunday', () => {
    const periods = resolveDashboardPeriods(new Date(2026, 9, 6));

    assert.deepEqual(periods.week, { fromKey: '2026-10-05', toKey: '2026-10-11' });
  });

  it('runs the month first to last, in a leap February too', () => {
    assert.deepEqual(resolveDashboardPeriods(new Date(2026, 9, 6)).month, {
      fromKey: '2026-10-01',
      toKey: '2026-10-31',
    });

    assert.deepEqual(resolveDashboardPeriods(new Date(2028, 1, 15)).month, {
      fromKey: '2028-02-01',
      toKey: '2028-02-29',
    });
  });

  it('keeps the week inside a month that starts mid-week', () => {
    // 1 November 2026 is a Sunday, so its week began in October.
    assert.deepEqual(resolveDashboardPeriods(new Date(2026, 10, 1)).week, {
      fromKey: '2026-10-26',
      toKey: '2026-11-01',
    });
  });

  it('defaults to now, so a caller cannot forget to pass a clock reading', () => {
    const periods = resolveDashboardPeriods();

    assert.deepEqual(periods.today.fromKey, periods.today.toKey);
    assert.ok(periods.today.fromKey <= periods.month.toKey);
  });
});