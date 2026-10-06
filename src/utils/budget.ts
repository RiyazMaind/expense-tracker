import { endOfMonth } from '@/utils/calculations';
import { fromDateKey, toMonthKey } from '@/utils/dates';

/**
 * Budget math.
 *
 * The amounts are *not* derived values and are never computed here — a budget
 * is a plan the user set, stored in `budgets`. What this module owns is the
 * comparison between that plan and the spending derived from `expenses`:
 * remaining, percentage, exceeded, and the pace the month is running at.
 * docs/data-model.md defines the formulas:
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

/**
 * The budget analytics the Home dashboard shows: how far along the month is,
 * what is left to spend, and where the month is heading at the pace so far.
 *
 * Built from the two persisted inputs (the plan and the month's spending) plus
 * one clock reading. Every field is recomputed on each read rather than stored,
 * so the projection can never drift away from the rows it describes
 * (docs/architecture.md, Database Rule).
 */
export type BudgetOutlook = {
  /** The spent-versus-budget comparison this module already owns. */
  progress: BudgetProgress;
  /** Days left in the month, today included. Always at least 1. */
  daysRemaining: number;
  /** What is left to spend, spread over `daysRemaining`. 0 once over budget. */
  dailyAllowancePaise: number;
  /** Where the month lands if the pace so far holds. Whole paise. */
  projectedPaise: number;
  /** `projected − budget`: positive when the pace overshoots, negative when it lands under. */
  projectedGapPaise: number;
  /** Whether the projection lands above the budget. */
  projectedExceeded: boolean;
};

/**
 * The month's outlook, from its plan, its spending and one clock reading.
 *
 * Two numbers here deserve their rules:
 *
 * - `dailyAllowancePaise` spreads the remainder over the days *including*
 *   today, so on the last day of the month the whole remainder is available
 *   today instead of being divided by zero. Once the budget is spent the
 *   allowance is 0 — a negative daily allowance is not something a user can
 *   act on, and the over-budget caption already carries that state.
 * - `projectedPaise` extrapolates `spent / dayOfMonth` across the whole month.
 *   `dayOfMonth` is at least 1, so it never divides by nothing; and because
 *   today's spending is only partially recorded, early in a day the projection
 *   reads as a *pace*, which is how the screen words it.
 */
export function computeBudgetOutlook(
  budgetPaise: number,
  spentPaise: number,
  reference: Date = new Date(),
): BudgetOutlook {
  const dayOfMonth = reference.getDate();
  const daysInMonth = endOfMonth(reference).getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;

  const progress = computeBudgetProgress(budgetPaise, spentPaise);

  const dailyAllowancePaise =
    progress.remainingPaise > 0 ? Math.round(progress.remainingPaise / daysRemaining) : 0;

  const projectedPaise = Math.round((spentPaise / dayOfMonth) * daysInMonth);
  const projectedGapPaise = projectedPaise - budgetPaise;

  return {
    progress,
    daysRemaining,
    dailyAllowancePaise,
    projectedPaise,
    projectedGapPaise,
    projectedExceeded: projectedGapPaise > 0,
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
