import type { Expense } from '@/database/repositories/expense-repository';
import { addDays, formatFullDate, fromDateKey, isSameDateKey, toDateKey } from '@/utils/dates';

/**
 * Turning a flat list of expenses into a date-grouped list.
 *
 * docs/screens.md asks the Expenses screen for date grouping alongside its rows,
 * so the grouping is done here rather than inside the screen: it is pure, it is
 * the one piece of this screen with real logic in it, and keeping it out of the
 * component means it can be tested without rendering anything.
 *
 * The output is a single flat array of headers and rows rather than a nested
 * structure, because that is the shape a virtualized list wants — see
 * vercel-react-native-skills/rules/list-performance-item-types.md on giving a
 * heterogeneous list a `type` so rows are not recycled into headers.
 *
 * Expense objects are passed through by reference and never copied. FlatList
 * decides what to re-render by comparing references, so rebuilding each row here
 * would make the whole visible list re-render on every page load
 * (vercel-react-native-skills/rules/list-performance-item-memo.md).
 */

/** A date header, or one expense row. Discriminated by `kind`. */
export type ExpenseGroupItem =
  | {
      kind: 'header';
      /** Stable list key. Unique across headers and rows alike. */
      key: string;
      dateKey: string;
      /** Short display label: "Today", "Tuesday, 6 Oct". */
      label: string;
      /** Unambiguous date for assistive tech: "Tuesday, 6 October 2026". */
      fullLabel: string;
      /** Everything spent on this day, in paise. */
      totalPaise: number;
      /** How many expenses the day holds. */
      count: number;
    }
  | {
      kind: 'expense';
      key: string;
      expense: Expense;
    };

/**
 * Formatters are hoisted to module scope — construction is expensive enough to
 * show up when a long list re-groups
 * (vercel-react-native-skills/rules/js-hoist-intl.md).
 */
const weekdayAndDayFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

/**
 * How a day is labelled.
 *
 * Today and Yesterday are named outright, because those are the two days a user
 * actually looks for and neither should have to be read off a date. Anything
 * else in the current year carries its weekday too, which is what makes a list
 * of recent days scannable — "Tuesday" says more at a glance than "6 Oct". The
 * year is only spelled out once it is not the current one, at which point it is
 * the detail most likely to be wrong.
 */
export function formatDateGroupLabel(dateKey: string, today: Date): string {
  const todayKey = toDateKey(today);

  if (isSameDateKey(dateKey, todayKey)) {
    return 'Today';
  }

  if (isSameDateKey(dateKey, toDateKey(addDays(today, -1)))) {
    return 'Yesterday';
  }

  const date = fromDateKey(dateKey);

  return date.getFullYear() === today.getFullYear()
    ? weekdayAndDayFormatter.format(date)
    : formatFullDate(date);
}

/**
 * Interleave date headers with their expenses.
 *
 * Groups are emitted in the order their first expense appears, and the caller's
 * ordering is preserved within each group. The history query already returns
 * `date DESC, id DESC`, so the common result is newest day first, newest entry
 * first within it — with no sort here, so paging and grouping cannot disagree.
 *
 * A `Map` keyed on the date is what keeps this correct: expenses arrive in date
 * order, but nothing guarantees the caller sorted them, and a plain
 * "previous item's date" comparison would silently emit a second header for the
 * same day rather than merging it.
 */
export function groupExpensesByDate(
  expenses: readonly Expense[],
  today: Date,
): ExpenseGroupItem[] {
  const groups = new Map<string, { totalPaise: number; expenses: Expense[] }>();

  for (const expense of expenses) {
    const group = groups.get(expense.date);

    if (group == null) {
      groups.set(expense.date, { totalPaise: expense.amountMinor, expenses: [expense] });
    } else {
      group.totalPaise += expense.amountMinor;
      group.expenses.push(expense);
    }
  }

  const items: ExpenseGroupItem[] = [];

  for (const [dateKey, group] of groups) {
    items.push({
      kind: 'header',
      // Namespaced so a header can never collide with a row key.
      key: `header:${dateKey}`,
      dateKey,
      label: formatDateGroupLabel(dateKey, today),
      fullLabel: formatFullDate(fromDateKey(dateKey)),
      totalPaise: group.totalPaise,
      count: group.expenses.length,
    });

    for (const expense of group.expenses) {
      items.push({ kind: 'expense', key: `expense:${expense.id}`, expense });
    }
  }

  return items;
}