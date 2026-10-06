import { fromDateKey, toMonthKey } from '@/utils/dates';

/**
 * Budget math.
 *
 * The amounts are *not* derived values and are never computed here — a budget
 * is a plan the user set, stored in `budgets`. What this module owns is the
 * comparison between that plan and the spending derived from `expenses`:
 * remaining, percentage, exceeded. docs/data-model.md defines the formulas:
 *
 *   remaining budget  = monthly budget - monthly spending  (can go negative)
 *   budget percentage = monthly spending / monthly budget * 100
 *
 * All money is whole paise. The only division in the app that is allowed to
 * produce a fraction is the percentage, and it never feeds back into an
 * amount.
 */

/** Everything the Budget screen shows, computed from the two inputs. */
export type BudgetProgress = {
  budgetPaise: number;
  spentPaise: number;
  /** Negative once spending passes the budget. */
  remainingPaise: number;
  /**
   * `spent / budget * 100`, uncapped. Over budget it reads 100 or more, which
   * is the truthful figure — capping is for the bar, not for the number.
   */
  percentUsed: number;
  /** True when spending has passed the budget. */
  exceeded: boolean;
  /**
   * Fraction of the bar to fill, capped at 1. The visual indicator must never
   * overshoot the track, while `percentUsed` keeps counting past 100.
   */
  visualFraction: number;
};

/**
 * The budget question for one month, from its two persisted inputs.
 *
 * A zero or negative budget cannot meaningfully be a percentage denominator:
 * `spent / 0` is not a number a user can act on. `percentUsed` falls back to
 * 0 (or, when spending exists against a zero budget, a floor of 100 with
 * `exceeded` true) so the screen can render rather than divide by nothing.
 */
export function computeBudgetProgress(budgetPaise: number, spentPaise: number): BudgetProgress {
  const remainingPaise = budgetPaise - spentPaise;
  const exceeded = spentPaise > budgetPaise;

  let percentUsed: number;

  if (budgetPaise > 0) {
    percentUsed = (spentPaise / budgetPaise) * 100;
  } else {
    percentUsed = spentPaise > 0 ? 100 : 0;
  }

  return {
    budgetPaise,
    spentPaise,
    remainingPaise,
    percentUsed,
    exceeded,
    visualFraction: budgetPaise > 0 ? Math.min(1, Math.max(0, spentPaise / budgetPaise)) : 0,
  };
}

/** The current month's budget key, derived from the same clock the totals use. */
export function currentMonthKey(reference: Date = new Date()): string {
  return toMonthKey(reference);
}

/** "October 2026" — what a `YYYY-MM` key reads as in a heading. */
export function formatMonthKey(monthKey: string): string {
  return monthYearFormatter.format(fromDateKey(`${monthKey}-01`));
}

/** Hoisted per vercel-react-native-skills/rules/js-hoist-intl.md. */
const monthYearFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
});
