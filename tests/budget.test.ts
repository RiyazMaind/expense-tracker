import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { runMigrations } from '@/database/migrations';
import { BudgetRepository } from '@/database/repositories/budget-repository';
import {
  ExpenseRepository,
  type NewExpense,
} from '@/database/repositories/expense-repository';
import {
  computeBudgetOutlook,
  computeBudgetProgress,
  formatMonthKey,
} from '@/utils/budget';
import { toMonthKey } from '@/utils/dates';
import { createTestDatabase, type TestDatabase } from './support/node-sqlite-driver.ts';

/**
 * Budget: one persisted row per month plus the arithmetic that turns it into
 * "how much is left". The repository tests run against real SQLite through the
 * node:sqlite adapter; the calculation tests are pure, like the analytics ones.
 */

function expense(overrides: Partial<NewExpense> = {}): NewExpense {
  return {
    amountPaise: 1000,
    category: 'food',
    dateKey: '2026-10-06',
    note: null,
    ...overrides,
  };
}

describe('BudgetRepository', () => {
  let db: TestDatabase;
  let budgets: BudgetRepository;
  let expenses: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    budgets = new BudgetRepository(db);
    expenses = new ExpenseRepository(db);
  });

  after(() => {
    db.close();
  });

  it('creates a budget and reads it back', async () => {
    const saved = await budgets.setMonthlyBudget({ monthKey: '2026-10', amountPaise: 2_000_000 });

    assert.equal(saved.monthKey, '2026-10');
    assert.equal(saved.amountMinor, 2_000_000);
    assert.ok(saved.id > 0);
    assert.equal(saved.createdAt, saved.updatedAt);
  });

  it('rejects a non-positive or non-integer amount', async () => {
    await assert.rejects(
      () => budgets.setMonthlyBudget({ monthKey: '2026-10', amountPaise: 0 }),
      /positive whole number of paise/,
    );
    await assert.rejects(
      () => budgets.setMonthlyBudget({ monthKey: '2026-10', amountPaise: 12.5 }),
      /positive whole number of paise/,
    );
  });

  it('rejects a malformed month key', async () => {
    await assert.rejects(
      () => budgets.setMonthlyBudget({ monthKey: '2026-13', amountPaise: 1000 }),
      /YYYY-MM/,
    );
    await assert.rejects(
      () => budgets.setMonthlyBudget({ monthKey: 'October 2026', amountPaise: 1000 }),
      /YYYY-MM/,
    );
  });

  it('updates the same month in place instead of adding a second row', async () => {
    const first = await budgets.setMonthlyBudget({ monthKey: '2026-11', amountPaise: 1_000_000 });
    const second = await budgets.setMonthlyBudget({ monthKey: '2026-11', amountPaise: 2_500_000 });

    assert.equal(second.id, first.id);
    assert.equal(second.amountMinor, 2_500_000);
    assert.equal(second.createdAt, first.createdAt);
    assert.ok(second.updatedAt >= first.updatedAt);

    const all = await db.getAllAsync<{ month: string }>('SELECT month FROM budgets');
    assert.equal(all.filter((row) => row.month === '2026-11').length, 1);
  });

  it('stores different months as independent rows', async () => {
    await budgets.setMonthlyBudget({ monthKey: '2026-09', amountPaise: 3_000_000 });

    const october = await budgets.getBudget('2026-10');
    const september = await budgets.getBudget('2026-09');

    assert.equal(october?.amountMinor, 2_000_000);
    assert.equal(september?.amountMinor, 3_000_000);
  });

  it('returns null when the month has no budget — the empty budget state', async () => {
    assert.equal(await budgets.getBudget('2026-12'), null);
  });

  it('retrieves the budget for the month it is asked about', async () => {
    const october = await budgets.getBudget(toMonthKey(new Date(2026, 9, 15)));

    assert.equal(october?.monthKey, '2026-10');
    assert.equal(october?.amountMinor, 2_000_000);
  });

  it('rejects a malformed month key on read too', async () => {
    await assert.rejects(() => budgets.getBudget('2026-10-06'), /YYYY-MM/);
  });
});

describe('spent against budget', () => {
  let db: TestDatabase;
  let budgets: BudgetRepository;
  let expenses: ExpenseRepository;

  before(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    budgets = new BudgetRepository(db);
    expenses = new ExpenseRepository(db);
  });

  after(() => {
    db.close();
  });

  it('counts exactly the month the budget covers, no float drift', async () => {
    await budgets.setMonthlyBudget({ monthKey: '2026-10', amountPaise: 2_000_000 });

    await expenses.insert(expense({ amountPaise: 125_050 }));
    await expenses.insert(expense({ amountPaise: 99, dateKey: '2026-10-31' }));
    await expenses.insert(expense({ amountPaise: 500_000, dateKey: '2026-09-30' }));
    await expenses.insert(expense({ amountPaise: 700_000, dateKey: '2026-11-01' }));

    const reference = new Date(2026, 9, 15);
    const budget = await budgets.getBudget(toMonthKey(reference));
    const summary = await expenses.getSummary(reference);

    assert.equal(budget?.amountMinor, 2_000_000);
    assert.equal(summary.monthPaise, 125_149);

    const progress = computeBudgetProgress(budget!.amountMinor, summary.monthPaise);
    assert.equal(progress.remainingPaise, 2_000_000 - 125_149);
    assert.equal(progress.exceeded, false);
  });

  it('resolves the month boundary exactly: Oct 1 counts this month, Sep 30 does not', async () => {
    // getSummary totals the calendar month, not the days elapsed — so the
    // boundary only ever matters as *which* month the total belongs to.
    assert.equal((await expenses.getSummary(new Date(2026, 9, 1))).monthPaise, 125_149);
    assert.equal((await expenses.getSummary(new Date(2026, 8, 30))).monthPaise, 500_000);
    assert.equal((await expenses.getSummary(new Date(2026, 10, 1))).monthPaise, 700_000);
  });
});

describe('computeBudgetProgress', () => {
  it('divides paise by paise and reports a whole percentage', () => {
    // docs/testing.md's acceptance figure: ₹20,000 budget, ₹12,000 spent.
    const progress = computeBudgetProgress(2_000_000, 1_200_000);

    assert.equal(progress.remainingPaise, 800_000);
    assert.equal(progress.percentUsed, 60);
    assert.equal(progress.exceeded, false);
    assert.equal(progress.visualFraction, 0.6);
  });

  it('lets remaining go negative and the percentage past 100 when exceeded', () => {
    const progress = computeBudgetProgress(2_000_000, 2_500_000);

    assert.equal(progress.remainingPaise, -500_000);
    assert.equal(progress.percentUsed, 125);
    assert.equal(progress.exceeded, true);
  });

  it('caps the visual fill at 100% while the percentage keeps counting', () => {
    const progress = computeBudgetProgress(2_000_000, 4_000_000);

    assert.equal(progress.percentUsed, 200);
    assert.equal(progress.visualFraction, 1);
  });

  it('treats an exactly-met budget as full, not exceeded', () => {
    const progress = computeBudgetProgress(2_000_000, 2_000_000);

    assert.equal(progress.remainingPaise, 0);
    assert.equal(progress.percentUsed, 100);
    assert.equal(progress.exceeded, false);
    assert.equal(progress.visualFraction, 1);
  });

  it('handles zero spending against a real budget', () => {
    const progress = computeBudgetProgress(2_000_000, 0);

    assert.equal(progress.remainingPaise, 2_000_000);
    assert.equal(progress.percentUsed, 0);
    assert.equal(progress.exceeded, false);
    assert.equal(progress.visualFraction, 0);
  });

  it('never divides by zero when the budget is zero', () => {
    assert.equal(computeBudgetProgress(0, 0).percentUsed, 0);
    assert.ok(computeBudgetProgress(0, 100).exceeded);
  });
});

describe('computeBudgetOutlook', () => {
  it('spreads what is left over the days remaining, today included', () => {
    // 6 October 2026, a 31-day month: 26 days left counting today.
    const outlook = computeBudgetOutlook(2_000_000, 1_200_000, new Date(2026, 9, 6));

    assert.equal(outlook.daysRemaining, 26);
    assert.equal(outlook.dailyAllowancePaise, Math.round(800_000 / 26));
    assert.equal(outlook.progress.remainingPaise, 800_000);
  });

  it('projects the month end from the pace so far and flags an overshoot', () => {
    // ₹12,000 over 6 days = ₹2,000/day × 31 days = ₹62,000 — well over ₹20,000.
    const outlook = computeBudgetOutlook(2_000_000, 1_200_000, new Date(2026, 9, 6));

    assert.equal(outlook.projectedPaise, 6_200_000);
    assert.equal(outlook.projectedGapPaise, 4_200_000);
    assert.equal(outlook.projectedExceeded, true);
  });

  it('reports a projection landing under the budget as a negative gap', () => {
    // ₹3,000 over 6 days = ₹500/day × 31 = ₹15,500 against a ₹20,000 budget.
    const outlook = computeBudgetOutlook(2_000_000, 300_000, new Date(2026, 9, 6));

    assert.equal(outlook.projectedPaise, 1_550_000);
    assert.equal(outlook.projectedGapPaise, -450_000);
    assert.equal(outlook.projectedExceeded, false);
  });

  it('stops the daily allowance at zero once the budget is spent', () => {
    const outlook = computeBudgetOutlook(2_000_000, 2_500_000, new Date(2026, 9, 6));

    assert.equal(outlook.progress.exceeded, true);
    assert.equal(outlook.dailyAllowancePaise, 0);
  });

  it('handles the last day: one day left and the whole remainder available', () => {
    const outlook = computeBudgetOutlook(1_000_000, 400_000, new Date(2026, 9, 31));

    assert.equal(outlook.daysRemaining, 1);
    assert.equal(outlook.dailyAllowancePaise, 600_000);
    // Every day has elapsed, so projecting the pace across the month is the spend itself.
    assert.equal(outlook.projectedPaise, 400_000);
    assert.equal(outlook.projectedExceeded, false);
  });

  it('counts a leap February as 29 days', () => {
    const outlook = computeBudgetOutlook(500_000, 100_000, new Date(2024, 1, 10));

    assert.equal(outlook.daysRemaining, 20);
    assert.equal(outlook.projectedPaise, Math.round((100_000 / 10) * 29));
  });

  it('projects a single day of spending across the whole month', () => {
    const outlook = computeBudgetOutlook(2_000_000, 100_000, new Date(2026, 9, 1));

    assert.equal(outlook.daysRemaining, 31);
    assert.equal(outlook.projectedPaise, 3_100_000);
    assert.equal(outlook.projectedExceeded, true);
  });

  it('carries the spent-versus-budget progress through unchanged', () => {
    const reference = new Date(2026, 9, 15);
    const outlook = computeBudgetOutlook(2_000_000, 1_200_000, reference);

    assert.deepEqual(outlook.progress, computeBudgetProgress(2_000_000, 1_200_000));
  });
});

describe('month keys', () => {
  it('formats a month key for a heading', () => {
    assert.equal(formatMonthKey('2026-10'), 'October 2026');
  });
});
