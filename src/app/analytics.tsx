import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { CategoryBreakdown } from '@/components/analytics/category-breakdown';
import { DailyTrendChart } from '@/components/analytics/daily-trend-chart';
import { TotalsHero } from '@/components/analytics/totals-hero';
import { StatTile } from '@/components/dashboard/stat-tile';
import { GlassCard } from '@/components/glass/glass-card';
import { GlassSurface } from '@/components/glass/glass-surface';
import { ButtonLabel, GlassButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { getDatabase } from '@/database/database';
import { AnalyticsRepository } from '@/database/repositories/analytics-repository';
import { colors, radii, spacing } from '@/theme';
import {
  buildAnalyticsReport,
  resolveAnalyticsPeriods,
  type AnalyticsReport,
} from '@/utils/analytics';
import { formatInr } from '@/utils/currency';
import { formatMonthYear, fromDateKey } from '@/utils/dates';

/**
 * Whether the last load worked.
 *
 * The report is kept alongside it, so "stale figures on screen after a failed
 * refresh" and "nothing to show at all" can be told apart: only the second one
 * replaces a working screen with an error
 * (vercel-react-native-skills/rules/state-ground-truth.md).
 */
type AnalyticsStatus = 'loading' | 'ready' | 'error';

/**
 * Analytics — where the spending actually went.
 *
 * docs/screens.md asks for a current period total, a daily chart, a category
 * breakdown, an average, and a highest-spending answer. All of them come from
 * three SQLite aggregations; nothing here reads expense rows to add them up in
 * JavaScript, and nothing derived is stored
 * (docs/architecture.md, Database Rule).
 *
 * State is local to this screen. The report is derived state that only this
 * screen displays, so it is re-read on focus rather than mirrored into the store
 * — which is also what makes it correct after an add, an edit or a delete
 * elsewhere, and across a midnight rollover, with no timer and no coordination
 * (vercel-react-native-skills/rules/react-state-minimize.md).
 */
export default function AnalyticsScreen() {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [status, setStatus] = useState<AnalyticsStatus>('loading');

  /*
    Focus can arrive again before the previous read has finished, and two reads
    need not finish in the order they started. Counting them lets the older one
    be dropped on arrival instead of overwriting newer numbers with numbers that
    were already superseded.
  */
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const loadId = latestLoad.current + 1;

    latestLoad.current = loadId;

    try {
      /*
        One clock reading for everything. `resolveAnalyticsPeriods` turns it into
        the three ranges, and the queries below are all resolved against that
        same reading — taking a second `new Date()` per query would let a month
        boundary fall between them and produce totals that disagree with the bars
        next to them.
      */
      const reference = new Date();
      const periods = resolveAnalyticsPeriods(reference);

      const repository = new AnalyticsRepository(await getDatabase());

      const [totals, categoryTotals, dailyTotals] = await Promise.all([
        repository.getPeriodTotals(reference),
        repository.getCategoryTotals(periods.month),
        repository.getDailyTotals(periods.trend),
      ]);

      if (latestLoad.current !== loadId) {
        return;
      }

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

      setStatus('ready');
    } catch (error) {
      if (latestLoad.current !== loadId) {
        return;
      }

      /*
        The last good report is deliberately left on screen. A failed refresh
        should show the figures the user last saw rather than wiping a working
        screen back to an error.
      */
      console.warn('[analytics] could not load analytics', error);
      setStatus('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addExpense = useCallback(() => {
    router.push('/add-expense');
  }, []);

  const periodLabel =
    report?.days[0] != null ? formatMonthYear(fromDateKey(report.days[0].dateKey)) : '';

  const showInitialLoading = status === 'loading' && report == null;

  return (
    <Screen testID="screen-analytics">
      <ScreenHeader
        title="Analytics"
        subtitle="Understand spending patterns"
        /*
          Settings used to be reachable from this slot as a text "Add" button.
          Add Expense now lives at the centre of the tab bar, and Settings sits
          here instead — a sliders icon, not a text button.
        */
        action={
          <Pressable
            testID="analytics-settings"
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            accessibilityHint="Opens the settings screen"
            onPress={() => router.push('/settings')}
            hitSlop={8}
          >
            <GlassSurface
              level="default"
              borderLevel="subtle"
              radius={radii.pill}
              shadow="sm"
              highlighted
              style={styles.settingsButton}
            >
              <Icon name="sliders" size={18} color={colors.text} testID="analytics-settings-icon" />
            </GlassSurface>
          </Pressable>
        }
      />

      {showInitialLoading ? (
        <View style={styles.centered} testID="analytics-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : status === 'error' && report == null ? (
        <EmptyState
          testID="analytics-error"
          title="Could not read your spending"
          body="Your data is still on this device. Try again in a moment."
          action={
            <GlassButton
              accessibilityLabel="Retry loading analytics"
              accessibilityHint="Reads the spending totals again"
              onPress={load}
              testID="analytics-retry"
            >
              <ButtonLabel>Try again</ButtonLabel>
            </GlassButton>
          }
        />
      ) : report != null && !report.hasExpenses ? (
        /*
          Driven by the all-time count, never by the monthly total: someone who
          logged an expense last month and none this month still has data, and
          telling them they have none would be wrong. docs/screens.md is explicit
          that an empty chart with no explanation is not acceptable, so this is
          the explanation plus the way out of it.
        */
        <EmptyState
          testID="empty-analytics"
          title="No spending to chart yet"
          body="Add your first expense and your weekly and monthly totals, daily trend and category breakdown will build themselves here."
          action={
            <GlassButton
              accessibilityLabel="Add expense"
              accessibilityHint="Opens the add expense screen"
              onPress={addExpense}
              testID="empty-analytics-add"
            >
              <ButtonLabel>Add expense</ButtonLabel>
            </GlassButton>
          }
        />
      ) : report != null ? (
        <>
          <TotalsHero
            label={`Spent in ${periodLabel}`}
            amountPaise={report.monthPaise}
            caption={heroCaption(report, periodLabel)}
            testID="analytics-hero"
          />

          {/*
            Two supporting totals, reusing the dashboard's StatTile rather than a
            second tile treatment: identical components across tabs are what makes
            the app read as one design system rather than four screens.
          */}
          <View style={styles.tiles}>
            <StatTile
              label="This week"
              value={formatInr(report.weekPaise)}
              testID="analytics-tile-week"
            />
            <StatTile
              label="Daily average"
              value={formatInr(report.averagePerDayPaise)}
              testID="analytics-tile-average"
            />
          </View>

          {report.hasMonthSpending ? (
            <>
              <DailyTrendChart
                periodLabel={periodLabel}
                days={report.days}
                monthPaise={report.monthPaise}
                busiestDay={report.busiestDay}
                daysWithSpending={report.daysWithSpending}
                testID="analytics-trend-card"
              />

              <CategoryBreakdown
                slices={report.categories}
                totalPaise={report.monthPaise}
                periodLabel={periodLabel}
                testID="analytics-categories"
              />
            </>
          ) : (
            /*
              Expenses exist, none of them this month. A chart of empty columns
              would be a chart that communicates nothing, so the section is
              replaced by the one sentence that explains where the numbers would
              have come from.
            */
            <GlassCard
              title="Nothing logged this month"
              subtitle={`Nothing recorded in ${periodLabel} yet. The trend and the category breakdown fill in as you add expenses.`}
              testID="analytics-no-month-spending"
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

/** The one supporting line under the hero amount. */
function heroCaption(report: AnalyticsReport, periodLabel: string): string {
  if (!report.hasMonthSpending) {
    return `Nothing recorded in ${periodLabel} yet`;
  }

  const days = report.daysWithSpending;

  return `${days} ${days === 1 ? 'day' : 'days'} with spending`;
}

const styles = StyleSheet.create({
  centered: {
    paddingTop: spacing.xxl,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  settingsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});