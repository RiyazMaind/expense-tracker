import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { CategoryBreakdown } from "@/components/analytics/category-breakdown";
import { DailyTrendChart } from "@/components/analytics/daily-trend-chart";
import { TotalsHero } from "@/components/analytics/totals-hero";
import { BudgetInsight } from "@/components/budget/budget-insight";
import { CompletedMonthBudget } from "@/components/budget/completed-month-budget";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { StatTile } from "@/components/dashboard/stat-tile";
import { GlassCard } from "@/components/glass/glass-card";
import { ButtonLabel, GlassButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SettingsIconButton } from "@/components/ui/settings-icon-button";
import { DEFAULT_CATEGORY_ID } from "@/constants/categories";
import { getDatabase } from "@/database/database";
import { AnalyticsRepository } from "@/database/repositories/analytics-repository";
import { BudgetRepository } from "@/database/repositories/budget-repository";
import { ExpenseRepository } from "@/database/repositories/expense-repository";
import { useCategory } from "@/store/categoryStore";
import { useExpenseStore } from "@/store/expenseStore";
import { colors, spacing } from "@/theme";
import {
  buildAnalyticsReport,
  resolveAnalyticsPeriods,
  type AnalyticsReport,
} from "@/utils/analytics";
import { formatInr } from "@/utils/currency";
import {
  computeBudgetOutlook,
  currentMonthKey,
  formatMonthKey,
  type BudgetOutlook,
} from "@/utils/budget";
import { endOfMonth } from "@/utils/calculations";
import { formatMonthYear, formatShortDay, fromDateKey, shiftMonthKey } from "@/utils/dates";

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
 *
 * The whole dashboard reads one month at a time. A switcher under the header
 * walks back through every past month that has expenses — hero, tiles, trend,
 * categories and budget all re-scope to it — and the forward arrow rejoins the
 * current month when it lands there. Past months state what happened ("Month
 * ended ₹X under budget") instead of forecasting what will, because every day
 * of a month being browsed has already happened.
 */
export default function HomeScreen() {
  const summary = useExpenseStore((state) => state.summary);
  const loadSummary = useExpenseStore((state) => state.loadSummary);

  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [reportStatus, setReportStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [viewMonthKey, setViewMonthKey] = useState<string | null>(null);
  const [loadedCurrentKey, setLoadedCurrentKey] = useState<string | null>(null);
  const [earliestMonthKey, setEarliestMonthKey] = useState<string | null>(null);
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
      const now = new Date();
      const currentKey = currentMonthKey(now);

      /*
        The month being read: the chosen one, or the current month when none is
        chosen. A past month reads against its own last day rather than "now",
        so its periods resolve inside it — `resolveAnalyticsPeriods` clips the
        trend to the reading it is given, and reads against "now" would describe
        today instead of the month on screen. Statements rather than a ternary
        for the reason the outlook block below gives: this project's Babel React
        Compiler cannot lower a conditional expression inside a `try`.
      */
      let reference = now;
      let monthKey = currentKey;

      if (viewMonthKey != null) {
        reference = endOfMonth(fromDateKey(`${viewMonthKey}-01`));
        monthKey = viewMonthKey;
      }

      const periods = resolveAnalyticsPeriods(reference);

      const database = await getDatabase();
      const repository = new AnalyticsRepository(database);

      const [totals, categoryTotals, dailyTotals, budgetRow, earliestMonth] =
        await Promise.all([
          repository.getPeriodTotals(reference),
          repository.getCategoryTotals(periods.month),
          repository.getDailyTotals(periods.trend),
          new BudgetRepository(database).getBudget(monthKey),
          new ExpenseRepository(database).getEarliestMonthKey(),
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
        outlook = computeBudgetOutlook(
          budgetRow.amountMinor,
          totals.monthPaise,
          reference,
        );
      }

      setBudget({ monthKey, outlook });
      setLoadedCurrentKey(currentKey);
      setEarliestMonthKey(earliestMonth);
      setReport(
        buildAnalyticsReport({
          periods,
          weekPaise: totals.weekPaise,
          monthPaise: totals.monthPaise,
          monthEntryCount: totals.monthEntryCount,
          expenseCount: totals.expenseCount,
          categoryTotals,
          dailyTotals,
        }),
      );
      setReportStatus("ready");
    } catch (error) {
      if (latestLoad.current !== loadId) {
        return;
      }

      /*
        The last good report is deliberately left in place. A failed refresh
        should keep showing the figures the user last saw rather than wiping a
        working screen back to an error.
      */
      console.warn("[home] could not load the spending breakdown", error);
      setReportStatus("error");
    }
  }, [viewMonthKey]);

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

  /*
    Switching months drops what is in flight before it can land: the read for
    the month being left would otherwise repopulate the screen under the new
    month's heading. The report is cleared for the same reason — a spinner is
    more honest than last month's numbers under this month's label — and the
    focus effect refires because `loadReport`'s identity now depends on
    `viewMonthKey`.
  */
  const handleMonthChange = useCallback((next: string | null) => {
    latestLoad.current += 1;
    setViewMonthKey(next);
    setReport(null);
    setBudget(null);
    setReportStatus("loading");
  }, []);

  const currentKey = loadedCurrentKey ?? currentMonthKey();
  const displayKey = viewMonthKey ?? currentKey;
  const isCurrentMonth = displayKey === currentKey;
  const canGoBack = earliestMonthKey != null && displayKey > earliestMonthKey;
  const canGoForward = displayKey < currentKey;
  const activeBudget = budget?.monthKey === displayKey ? budget : null;

  const handlePrevMonth = useCallback(() => {
    if (canGoBack) {
      handleMonthChange(shiftMonthKey(displayKey, -1));
    }
  }, [canGoBack, displayKey, handleMonthChange]);

  const handleNextMonth = useCallback(() => {
    if (canGoForward) {
      const nextKey = shiftMonthKey(displayKey, 1);
      handleMonthChange(nextKey < currentKey ? nextKey : null);
    }
  }, [canGoForward, currentKey, displayKey, handleMonthChange]);

  const handleResetMonth = useCallback(() => {
    handleMonthChange(null);
  }, [handleMonthChange]);

  const hasExpenses = (summary?.expenseCount ?? 0) > 0;

  const periodLabel =
    report?.days[0] != null
      ? formatMonthYear(fromDateKey(report.days[0].dateKey))
      : "";

  /*
    The one supporting line under the month total. Read from the report rather
    than the summary because "days with spending" is a property of the series,
    not of the aggregate.
  */
  const monthCaption =
    report != null && report.hasMonthSpending
      ? monthCaptionText(report)
      : undefined;

  const busiestDayLabel =
    report?.busiestDay != null
      ? formatShortDay(fromDateKey(report.busiestDay.dateKey))
      : "—";

  /*
    Top category names itself through the same store the list rows use, so a
    user-created category is spelled by its real label. The hook is called with a
    fallback id rather than under a conditional, so the hook order never depends
    on whether a report has loaded.
  */
  const topCategory = useCategory(report?.highestCategory?.category ?? DEFAULT_CATEGORY_ID);
  const topCategoryLabel = report?.highestCategory != null ? topCategory.label : "—";

  const heroLabel = isCurrentMonth
    ? "Spent this month"
    : `Spent in ${formatMonthKey(displayKey)}`;

  /*
    The current month prefers the cached summary, so its hero is on screen the
    instant the screen is — a month being browsed has no cached counterpart and
    reads from the report, which is `null` while its load runs (the spinner
    below covers that gap).
  */
  const heroAmountPaise = isCurrentMonth
    ? (summary?.monthPaise ?? report?.monthPaise ?? 0)
    : (report?.monthPaise ?? 0);

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
        The month everything below is scoped to. Hidden on the first-run empty
        state: there is no earlier month to browse, and a control that does
        nothing but explain that is noise.
      */}
      {hasExpenses ? (
        <MonthSwitcher
          label={formatMonthKey(displayKey)}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={handlePrevMonth}
          onForward={handleNextMonth}
          onReset={isCurrentMonth ? undefined : handleResetMonth}
          testID="home-month-switcher"
        />
      ) : null}

      {/*
        The month is the number the budget is measured against, so it takes the
        hero and everything below is context for it.
      */}
      <TotalsHero
        label={heroLabel}
        amountPaise={heroAmountPaise}
        caption={monthCaption}
        testID="home-hero"
      />

      <View style={styles.tiles}>
        {isCurrentMonth ? (
          <>
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
          </>
        ) : (
          <>
            {/*
              The current pair is anchored to "now" and means nothing for a
              month that has ended, so a month being browsed answers its own
              questions instead: how many entries, and what dominated them.
            */}
            <StatTile
              label="Expenses"
              value={report != null ? String(report.monthEntryCount) : "—"}
              testID="tile-month-count"
            />
<StatTile
              label="Top category"
              value={topCategoryLabel}
              testID="tile-top-category"
            />
          </>
        )}
      </View>

      <View style={styles.tiles}>
        <StatTile
          label="Daily average"
          value={formatInr(report?.averagePerDayPaise ?? 0)}
          testID="tile-average"
        />
        <StatTile
          label="Busiest day"
          value={busiestDayLabel}
          testID="tile-busiest"
        />
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
              onPress={() => router.push("/add-expense")}
              testID="empty-home-add"
            >
              <ButtonLabel>Add expense</ButtonLabel>
            </GlassButton>
          }
        />
      ) : report == null && reportStatus === "loading" ? (
        <View style={styles.centered} testID="home-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : report == null && reportStatus === "error" ? (
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
          title={
            isCurrentMonth
              ? "Nothing logged this month"
              : `Nothing logged in ${periodLabel}`
          }
          subtitle={
            isCurrentMonth
              ? `Nothing recorded in ${periodLabel} yet. The trend and the category breakdown fill in as you add expenses.`
              : `Nothing recorded in ${periodLabel}. An expense dated in this month will show up here.`
          }
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

        A month being browsed gets the outcome card instead of the forecast:
        the outlook for a completed month has no days left to change it, so
        "Month ends ₹X · N days left" would be a claim about days that already
        happened. An unset budget for a past month offers no set button either —
        there is no longer a month to plan.
      */}
      {hasExpenses && activeBudget != null ? (
        activeBudget.outlook != null ? (
          isCurrentMonth ? (
            <BudgetInsight
              outlook={activeBudget.outlook}
              monthKey={activeBudget.monthKey}
              testID="home-budget"
            />
          ) : (
            <CompletedMonthBudget
              outlook={activeBudget.outlook}
              monthKey={activeBudget.monthKey}
              testID="home-budget"
            />
          )
        ) : isCurrentMonth ? (
          <GlassCard
            title="Budget progress"
            subtitle={`No budget set for ${formatMonthKey(activeBudget.monthKey)}`}
            testID="home-budget-empty"
          >
            <GlassButton
              accessibilityLabel="Set a monthly budget"
              accessibilityHint="Opens the budget screen to set this month's budget"
              onPress={() => router.push("/budget")}
              testID="home-budget-set"
            >
              <ButtonLabel>Set budget</ButtonLabel>
            </GlassButton>
          </GlassCard>
        ) : (
          <GlassCard
            title="Budget progress"
            subtitle={`No budget set for ${formatMonthKey(activeBudget.monthKey)}`}
            testID="home-budget-empty"
          />
        )
      ) : null}
    </Screen>
  );
}

/** The one supporting line under the month total. */
function monthCaptionText(report: AnalyticsReport): string {
  const days = report.daysWithSpending;

  return `${days} ${days === 1 ? "day" : "days"} with spending`;
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: "row",
    gap: spacing.md,
  },
  centered: {
    paddingTop: spacing.xxl,
    alignItems: "center",
  },
});
