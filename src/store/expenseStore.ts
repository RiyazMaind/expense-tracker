import { create } from 'zustand';

import { getDatabase } from '@/database/database';
import {
  ExpenseRepository,
  type ExpenseSummary,
} from '@/database/repositories/expense-repository';

/**
 * Dashboard state.
 *
 * docs/architecture.md puts Zustand between the screens and the repository, and
 * is explicit that this is *not* the database: it holds the last summary that
 * was read, so the dashboard renders immediately on the way back from the entry
 * screen instead of flashing empty while a query runs. The rows themselves live
 * in SQLite and are re-read on every focus.
 */

export type SummaryStatus = 'idle' | 'loading' | 'ready' | 'error';

type ExpenseStore = {
  summary: ExpenseSummary | null;
  status: SummaryStatus;
  /** Read the summary from SQLite and cache it. Safe to call on every focus. */
  loadSummary: () => Promise<void>;
};

/**
 * The query currently in flight, shared across every caller.
 *
 * Home focusing while an insert is still finishing is an ordinary sequence, not
 * an edge case, and without this the second caller would start a duplicate query
 * and flip the status back to `loading` after it had already resolved.
 */
let inFlight: Promise<void> | null = null;

export const useExpenseStore = create<ExpenseStore>((set) => ({
  summary: null,
  status: 'idle',

  loadSummary: () => {
    if (inFlight != null) {
      return inFlight;
    }

    set({ status: 'loading' });

    const request = (async () => {
      try {
        const repository = new ExpenseRepository(await getDatabase());
        set({ summary: await repository.getSummary(), status: 'ready' });
      } catch (error) {
        /*
          The previous summary is deliberately left in place. A failed refresh
          should show the numbers the user last saw, not wipe a working dashboard
          back to zero — and if there was never a summary, `null` leaves the
          screen in its pre-load state, which is honest about knowing nothing.
        */
        console.warn('[expense-store] could not load the expense summary', error);
        set({ status: 'error' });
      } finally {
        /*
          Cleared on the way out, including on failure, so a settled query never
          blocks the next one. Callers already hold `request` from the return
          below, so clearing this does not shorten anyone's wait.
        */
        inFlight = null;
      }
    })();

    inFlight = request;

    return request;
  },
}));