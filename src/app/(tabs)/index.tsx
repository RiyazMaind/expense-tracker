import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CategoryBreakdown } from '@/components/analytics/category-breakdown';
import { DailyTrendChart } from '@/components/analytics/daily-trend-chart';
import { TotalsHero } from '@/components/analytics/totals-hero';
import { BudgetInsight } from '@/components/budget/budget-insight';
import { StatTile } from '@/components/dashboard/stat-tile';
import { GlassCard } from '@/components/glass/glass-card';
import { ButtonLabel, GlassButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingsIconButton } from '@/components/ui/settings-icon-button';
import { getDatabase } from '@/database/database';
import { AnalyticsRepository } from '@/database/repositories/analytics-repository';
import { BudgetRepository } from '@/database/repositories/budget-repository';
import { useExpenseStore } from '@/store/expenseStore';
import { colors, spacing } from '@/theme';
import {
  buildAnalyticsReport,
  resolveAnalyticsPeriods,
  type AnalyticsReport,
} from '@/utils/analytics';
import {
  computeBudgetOutlook,
  currentMonthKey,
  formatMonthKey,
  type BudgetOutlook,
} from '@/utils/budget';
import { formatInr } from '@/utils/currency';
import { formatMonthYear, formatShortDay, fromDateKey } from '@/utils/dates';

/**
 * Home — the overview and the breakdown, on one screen.
 *
 * The month total is the hero, today and this week sit under it, and the daily
 * trend and category breakdown follow. docs/product.md asks the dashboard for
 * today/week/month and docs/screens.md asks analytics for the daily chart, the
 * category breakdown, the daily average and the highest-spending day — all of it
 * is here, because sending the user to a second screen to read their own numbers
 * meant the two halves of the same story could disagree about what a week is.
 *
 * Two reads feed it. Period totals come from the store, which caches the last
 * summary so the figures are on screen immediately on the way back from the
 * entry screen. The trend, the category breakdown and the budget outlook come
 * from a local report re-read on every focus; it stays local because it is
 * derived and only this screen shows it
 * (vercel-react-native-skills/rules/react-state-minimize.md). The budget row
 * rides along on that same load so one clock reading picks the month the
 * budget describes and the totals that measure it — two reads could straddle
 * a month boundary and pair last month's plan with this month's spending.
 *
 * One hero, deliberately: docs/design-system.md puts large amounts at the top of
 * the hierarchy and glassmorphism-design forbids two loudest things at once, so
 * every other figure is a tile. Nothing derived is stored — `buildAnalyticsReport`
 * runs on query results and SQLite keeps only the rows
 * (docs/architecture.md, Database Rule).
 */
export default function HomeScreen() {
  const summary = useExpenseStore((state) => state.summary);
  const loadSummary = useExpenseStore((state) => state.loadSummary);

  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [reportStatus, setReportStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  /*
    The budget snapshot: which month it describes, and its outlook — or `null`
    outlook for "no budget set for that month". The wrapper itself is `null`
    until the first successful read, so an unloaded budget is never mistaken
    for an unset one.
  */
  const [budget, setBudget] = useState<{
    monthKey: string;
    outlook: BudgetOutlook | null;
  } | null>(null);

  /*
    Focus can arrive again before the previous read has finished, and two reads
    need not finish in the order they started. Counting them lets the older one
    be dropped on arrival instead of overwriting newer numbers with numbers that
    were already superseded.
  */
  const latestLoad = useRef(0);

  const loadReport = useCallback(async () => {
    const loadId = latestLoad.current + 1;

    latestLoad.current = loadId;

    try {
      /*
        One clock reading for everything. `resolveAnalyticsPeriods` turns it into
        the three ranges and every query below resolves against that same
        reading, so a month boundary cannot fall between them and produce totals
        that disagree with the bars beside them.
      */
      const reference = new Date();
      const periods = resolveAnalyticsPeriods(reference);
      const monthKey = currentMonthKey(reference);

      const database = await getDatabase();
      const repository = new AnalyticsRepository(database);

      const [totals, categoryTotals, dailyTotals, budgetRow] = await Promise.all([
        repository.getPeriodTotals(reference),
        repository.getCategoryTotals(periods.month),
        repository.getDailyTotals(periods.trend),
        new BudgetRepository(database).getBudget(monthKey),
      ]);

      if (latestLoad.current !== loadId) {
        return;
      }

      /*
        An `if` rather than the obvious ternary: this project's Babel React
        Compiler cannot lower a value block inside a `try` ("Support value
        blocks ... within a try/catch statement") and fails the bundle — while
        typecheck, lint and the Node suite all pass on it, the same gap
        expenses.tsx documents for `finally`. Statements inside `try` are fine;
        conditional *expressions* are not.
      */
      let outlook: BudgetOutlook | null = null;

      if (budgetRow != null) {
        outlook = computeBudgetOutlook(budgetRow.amountMinor, totals.monthPaise, reference);
      }

      setBudget({ monthKey, outlook });
      setReport(
        buildAnalyticsReport({
          periods,
          weekPaise: totals.weekPaise,
          monthPaise: totals.monthPaise,
          expenseCount: totals.expenseCount,
          categoryTotals,
          dailyTotals,
        }),
      );
      setReportStatus('ready');
    } catch (error) {
      if (latestLoad.current !== loadId) {
        return;
      }

      /*
        The last good report is deliberately left in place. A failed refresh
        should keep showing the figures the user last saw rather than wiping a
        working screen back to an error.
      */
      console.warn('[home] could not load the spending breakdown', error);
      setReportStatus('error');
    }
  }, []);

  /*
    Focus, not mount. This screen stays mounted while the user is in
    add-expense, so a one-shot load on mount would leave the figures describing
    the moment the app opened rather than the moment they looked. It is also what
    makes them correct across a midnight rollover, with no timer.
  */
  useFocusEffect(
    useCallback(() => {
      loadSummary();
      loadReport();
    }, [loadSummary, loadReport]),
  );

  const hasExpenses = (summary?.expenseCount ?? 0) > 0;

  const periodLabel =
    report?.days[0] != null ? formatMonthYear(fromDateKey(report.days[0].dateKey)) : '';

  /*
    The one supporting line under the month total. Read from the report rather
    than the summary because "days with spending" is a property of the series,
    not of the aggregate.
  */
  const monthCaption =
    report != null && report.hasMonthSpending ? monthCaptionText(report) : undefined;

  const busiestDayLabel =
    report?.busiestDay != null ? formatShortDay(fromDateKey(report.busiestDay.dateKey)) : '—';

  return (
    <Screen testID="screen-home">
      <ScreenHeader
        title="Home"
        subtitle="Your spending at a glance"
        /*
          Adding lives in the centre of the tab bar; this slot carries the
          Settings shortcut.
        */
        action={<SettingsIconButton testID="home-settings" />}
      />

      {/*
        The month is the number the budget is measured against, so it takes the
        hero and everything below is context for it.
      */}
      <TotalsHero
        label="Spent this month"
        amountPaise={summary?.monthPaise ?? report?.monthPaise ?? 0}
        caption={monthCaption}
        testID="home-hero"
      />

      <View style={styles.tiles}>
        <StatTile
          label="Today"
          value={formatInr(summary?.todayPaise ?? 0)}
          testID="tile-today"
        />
        <StatTile
          label="This week"
          value={formatInr(summary?.weekPaise ?? 0)}
          testID="tile-week"
        />
      </View>

      <View style={styles.tiles}>
        <StatTile
          label="Daily average"
          value={formatInr(report?.averagePerDayPaise ?? 0)}
          testID="tile-average"
        />
        <StatTile label="Busiest day" value={busiestDayLabel} testID="tile-busiest" />
      </View>

      {/*
        Driven by the all-time count rather than by today's figure: someone who
        logged an expense last month should not be told they have none.
      */}
      {!hasExpenses ? (
        <EmptyState
          testID="empty-home"
          title="No expenses yet"
          body="Start tracking your spending by adding your first expense. Your daily trend and category breakdown build themselves from here."
          action={
            <GlassButton
              accessibilityLabel="Add expense"
              accessibilityHint="Opens the add expense screen"
              onPress={() => router.push('/add-expense')}
              testID="empty-home-add"
            >
              <ButtonLabel>Add expense</ButtonLabel>
            </GlassButton>
          }
        />
      ) : report == null && reportStatus === 'loading' ? (
        <View style={styles.centered} testID="home-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : report == null && reportStatus === 'error' ? (
        <EmptyState
          testID="home-error"
          title="Could not read your spending"
          body="Your data is still on this device. Try again in a moment."
          action={
            <GlassButton
              accessibilityLabel="Retry reading your spending"
              accessibilityHint="Reads the spending breakdown again"
              onPress={loadReport}
              testID="home-retry"
            >
              <ButtonLabel>Try again</ButtonLabel>
            </GlassButton>
          }
        />
      ) : report != null && report.hasMonthSpending ? (
        <>
          <DailyTrendChart
            periodLabel={periodLabel}
            days={report.days}
            monthPaise={report.monthPaise}
            busiestDay={report.busiestDay}
            daysWithSpending={report.daysWithSpending}
            testID="home-trend-card"
          />

          <CategoryBreakdown
            slices={report.categories}
            totalPaise={report.monthPaise}
            periodLabel={periodLabel}
            testID="home-categories"
          />
        </>
      ) : report != null ? (
        /*
          Expenses exist, none of them this month. A chart of empty columns would
          communicate nothing, so the section is replaced by the one sentence
          that explains where the numbers would have come from.
        */
        <GlassCard
          title="Nothing logged this month"
          subtitle={`Nothing recorded in ${periodLabel} yet. The trend and the category breakdown fill in as you add expenses.`}
          testID="home-no-month-spending"
        />
      ) : null}

      {/*
        Budget progress last, in the order docs/screens.md lists it: it measures
        the month total above, so it belongs after the charts that break that
        total down rather than between the hero and its supporting tiles. It
        shows whenever expenses exist — even a month with no spending still has
        a truthful "0% used, everything left" — and steps aside entirely on the
        first-run empty state, where the one thing to do is log an expense.
      */}
      {hasExpenses && budget != null ? (
        budget.outlook != null ? (
          <BudgetInsight
            outlook={budget.outlook}
            monthKey={budget.monthKey}
            testID="home-budget"
          />
        ) : (
          <GlassCard
            title="Budget progress"
            subtitle={`No budget set for ${formatMonthKey(budget.monthKey)}`}
            testID="home-budget-empty"
          >
            <GlassButton
              accessibilityLabel="Set a monthly budget"
              accessibilityHint="Opens the budget screen to set this month's budget"
              onPress={() => router.push('/budget')}
              testID="home-budget-set"
            >
              <ButtonLabel>Set budget</ButtonLabel>
            </GlassButton>
          </GlassCard>
        )
      ) : null}
    </Screen>
  );
}

/** The one supporting line under the month total. */
function monthCaptionText(report: AnalyticsReport): string {
  const days = report.daysWithSpending;

  return `${days} ${days === 1 ? 'day' : 'days'} with spending`;
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  centered: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
});
