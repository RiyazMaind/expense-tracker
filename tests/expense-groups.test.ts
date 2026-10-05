import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Expense } from '@/database/repositories/expense-repository';
import { formatDateGroupLabel, groupExpensesByDate } from '@/utils/expense-groups';
import { formatFullDate, fromDateKey, toDateKey } from '@/utils/dates';

/**
 * Date grouping for the expense history.
 *
 * `today` is Tuesday 6 October 2026 and every expense is built from a local date
 * key, so the suite means the same thing in every timezone it runs in. Which days
 * those are, is what makes the label tests meaningful: the 6th is today, the 5th
 * is yesterday, the 3rd is earlier in the same year and the 25th of December 2025
 * is in another one.
 */
const TODAY = new Date(2026, 9, 6);

function expense(overrides: Partial<Expense> & { id: number; date: string }): Expense {
  return {
    amountMinor: 1000,
    category: 'food',
    note: null,
    createdAt: '2026-10-06T09:00:00.000Z',
    updatedAt: '2026-10-06T09:00:00.000Z',
    ...overrides,
  };
}

describe('formatDateGroupLabel', () => {
  it('names today outright', () => {
    assert.equal(formatDateGroupLabel('2026-10-06', TODAY), 'Today');
  });

  it('names yesterday outright', () => {
    assert.equal(formatDateGroupLabel('2026-10-05', TODAY), 'Yesterday');
  });

  it('carries the weekday for other days in the same year, and no year', () => {
    // Saturday 3 October 2026.
    assert.equal(formatDateGroupLabel('2026-10-03', TODAY), 'Saturday, 3 Oct');
  });

  it('spells out the year once it is not the current one', () => {
    assert.equal(
      formatDateGroupLabel('2025-12-25', TODAY),
      formatFullDate(fromDateKey('2025-12-25')),
    );
  });

  it('follows the year the reading is taken in', () => {
    // The same day is "earlier this year" in 2026 and "another year" in 2024.
    assert.equal(formatDateGroupLabel('2026-10-06', new Date(2024, 9, 6)), formatFullDate(fromDateKey('2026-10-06')));
  });

  it('calls a day from earlier today’s week yesterday, not by weekday', () => {
    // Monday 5 October is yesterday from Tuesday, and would be "Monday, 5 Oct"
    // three days later — the label tracks the reading, not the calendar alone.
    assert.equal(formatDateGroupLabel('2026-10-05', new Date(2026, 9, 8)), 'Monday, 5 Oct');
  });
});

describe('groupExpensesByDate', () => {
  it('returns nothing for no expenses', () => {
    assert.deepEqual(groupExpensesByDate([], TODAY), []);
  });

  it('puts one header above each day, then that day’s expenses', () => {
    const items = groupExpensesByDate(
      [
        expense({ id: 1, date: '2026-10-06' }),
        expense({ id: 2, date: '2026-10-06' }),
        expense({ id: 3, date: '2026-10-04' }),
      ],
      TODAY,
    );

    assert.deepEqual(
      items.map((item) => [item.kind, item.key]),
      [
        ['header', 'header:2026-10-06'],
        ['expense', 'expense:1'],
        ['expense', 'expense:2'],
        ['header', 'header:2026-10-04'],
        ['expense', 'expense:3'],
      ],
    );
  });

  it('keeps the caller’s order within a day', () => {
    const items = groupExpensesByDate(
      [
        expense({ id: 9, date: '2026-10-06' }),
        expense({ id: 8, date: '2026-10-06' }),
      ],
      TODAY,
    );

    assert.deepEqual(
      items.filter((item) => item.kind === 'expense').map((item) => item.expense.id),
      [9, 8],
    );
  });

  it('totals the day under its header', () => {
    const items = groupExpensesByDate(
      [
        expense({ id: 1, date: '2026-10-06', amountMinor: 125050 }),
        expense({ id: 2, date: '2026-10-06', amountMinor: 9990 }),
        expense({ id: 3, date: '2026-10-04', amountMinor: 500 }),
      ],
      TODAY,
    );

    const headers = items.filter((item) => item.kind === 'header');

    assert.deepEqual(
      headers.map((header) => [header.dateKey, header.totalPaise, header.count]),
      [
        ['2026-10-06', 135040, 2],
        ['2026-10-04', 500, 1],
      ],
    );
  });

  it('gives every header an unambiguous date for assistive tech', () => {
    const [header] = groupExpensesByDate([expense({ id: 1, date: '2026-10-06' })], TODAY);

    assert.equal(header?.kind, 'header');
    assert.equal(
      header?.kind === 'header' ? header.fullLabel : '',
      formatFullDate(fromDateKey('2026-10-06')),
    );
  });

  it('orders groups by first appearance, so the query’s order survives', () => {
    const items = groupExpensesByDate(
      [
        expense({ id: 1, date: '2026-10-06' }),
        expense({ id: 2, date: '2026-10-05' }),
        expense({ id: 3, date: '2026-10-06' }),
      ],
      TODAY,
    );

    const dayOrder = items
      .filter((item) => item.kind === 'header')
      .map((item) => (item.kind === 'header' ? item.dateKey : ''));

    assert.deepEqual(dayOrder, ['2026-10-06', '2026-10-05']);
  });

  it('merges a day that arrives in two runs instead of repeating its header', () => {
    // Nothing promises the caller sorted by date, and comparing each row against
    // the previous one would emit a second "6 Oct" header here.
    const items = groupExpensesByDate(
      [
        expense({ id: 1, date: '2026-10-06' }),
        expense({ id: 2, date: '2026-10-04' }),
        expense({ id: 3, date: '2026-10-06' }),
      ],
      TODAY,
    );

    assert.equal(items.filter((item) => item.kind === 'header').length, 2);

    const header = items.find((item) => item.kind === 'header');

    assert.equal(header?.kind === 'header' ? header.count : 0, 2);
  });

  it('gives every item a key no other item can share', () => {
    const items = groupExpensesByDate(
      [
        expense({ id: 1, date: '2026-10-06' }),
        expense({ id: 2, date: '2026-10-06' }),
        expense({ id: 3, date: '2026-10-04' }),
      ],
      TODAY,
    );

    const keys = items.map((item) => item.key);

    assert.equal(new Set(keys).size, keys.length);
  });

  it('passes expenses through by reference, so memoised rows do not re-render', () => {
    // FlatList compares props by identity. Copying the expense here would make
    // every visible row look changed on every page load.
    const rows = [expense({ id: 1, date: '2026-10-06' })];
    const items = groupExpensesByDate(rows, TODAY);
    const rendered = items.find((item) => item.kind === 'expense');

    assert.equal(rendered?.kind === 'expense' ? rendered.expense : null, rows[0]);
  });

  it('relabels relative to the reading it is given', () => {
    const rows = [expense({ id: 1, date: '2026-10-06' })];
    const header = (items: ReturnType<typeof groupExpensesByDate>) =>
      items.find((item) => item.kind === 'header');

    assert.equal(header(groupExpensesByDate(rows, TODAY))?.label, 'Today');
    assert.equal(header(groupExpensesByDate(rows, new Date(2026, 9, 7)))?.label, 'Yesterday');
  });
});

describe('date keys used by the history', () => {
  it('keeps a grouped day consistent with the key it is stored under', () => {
    // Guards the round trip the grouping relies on: fromDateKey -> toDateKey must
    // return the same key, or a header could describe a day its rows are not on.
    for (const key of ['2026-10-06', '2026-01-01', '2026-12-31']) {
      assert.equal(toDateKey(fromDateKey(key)), key);
    }
  });
});