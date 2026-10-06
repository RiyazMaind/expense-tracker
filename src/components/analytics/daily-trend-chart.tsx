import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/glass/glass-card';
import { Text } from '@/components/ui/text';
import { borders, colors, glass, radii, spacing } from '@/theme';
import type { AnalyticsReport } from '@/utils/analytics';
import { formatInr } from '@/utils/currency';
import { formatShortDay, fromDateKey } from '@/utils/dates';

export type DailyTrendChartProps = {
  /** The month the chart covers, e.g. "October 2026". */
  periodLabel: string;
  days: AnalyticsReport['days'];
  monthPaise: number;
  busiestDay: AnalyticsReport['busiestDay'];
  daysWithSpending: number;
  testID?: string;
};

/** Plot area height in points. Sized so a column is readable at 360dp. */
const PLOT_HEIGHT = 96;

/**
 * The daily spending trend, as columns.
 *
 * Built from plain `View`s. A charting library would bring its own scales,
 * legends, tooltips and interaction model for a series of at most 31 numbers,
 * none of which would survive a 360dp screen and a thumb — glassmorphism-design
 * lists "introduce dependencies just for decorative effects" as an anti-pattern,
 * and mobile-ui-review asks that a chart "never be decorative without
 * communicating information". One track, one bar, one axis.
 *
 * Every column carries a faint full-height track behind it. That is what makes a
 * run of quiet days legible: the days are visibly *there* at near-zero height,
 * instead of leaving holes in the chart that read as missing data. Bar heights
 * stay strictly proportional to the amounts, so the track aids reading without
 * distorting anything.
 */
export function DailyTrendChart({
  periodLabel,
  days,
  monthPaise,
  busiestDay,
  daysWithSpending,
  testID,
}: DailyTrendChartProps) {
  const axisLabels = buildAxisLabels(days);

  const spokenSummary = buildSpokenSummary({
    periodLabel,
    days,
    monthPaise,
    busiestDay,
    daysWithSpending,
  });

  return (
    <GlassCard title="Daily spending" subtitle={periodLabel} testID={testID}>
      {/*
        Announced as one item. Thirty-one columns read individually would be
        unusable — the summary carries the same information as a sentence, which
        is the data-table alternative ui-ux-pro-max asks for when a chart cannot
        be navigated by touch.
      */}
      <View
        style={styles.plot}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={spokenSummary}
        testID="analytics-trend"
      >
        {days.map((day) => (
          <View
            key={day.dateKey}
            style={styles.column}
            testID={`analytics-trend-day-${day.dayOfMonth}`}
          >
            <View style={styles.track}>
              {day.totalPaise > 0 ? (
                <View
                  style={[styles.bar, { height: `${Math.round(day.height * 100)}%` }]}
                  testID={`analytics-trend-bar-${day.dayOfMonth}`}
                />
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <View
        style={styles.axis}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {axisLabels.map((label) => (
          <Text
            key={label}
            variant="micro"
            tone="tertiary"
            tabular
            style={styles.axisLabel}
          >
            {label}
          </Text>
        ))}
      </View>

      <Text variant="caption" tone="secondary" style={styles.footnote} testID="analytics-busiest">
        {busiestDaySummary(busiestDay)}
      </Text>
    </GlassCard>
  );
}

/**
 * Three numbers under the plot: the first day, the middle and the last.
 *
 * Labelling every column would be unreadable at 360dp — a column is about 9pt
 * wide and a two-digit day number is wider than that — and labelling every
 * seventh day drifts out of alignment with the columns as the month length
 * changes. Three fixed positions stay honest at every month length.
 */
function buildAxisLabels(days: AnalyticsReport['days']): string[] {
  if (days.length === 0) {
    return [];
  }

  const first = String(days[0].dayOfMonth);
  const last = String(days[days.length - 1].dayOfMonth);
  const middle = String(days[Math.floor((days.length - 1) / 2)].dayOfMonth);

  return middle === first || middle === last ? [first, last] : [first, middle, last];
}

/** The busiest-day line. Falls back to plain copy when there is no spending. */
function busiestDaySummary(busiestDay: AnalyticsReport['busiestDay']): string {
  if (busiestDay == null) {
    return 'No spending recorded yet.';
  }

  const when = formatShortDay(fromDateKey(busiestDay.dateKey));

  return `Busiest day ${when} · ${formatInr(busiestDay.totalPaise)}`;
}

/**
 * The chart as one sentence.
 *
 * Total, coverage, peak and where it happened. A screen reader user gets the
 * shape of the month — when it was busy and by how much — without the visual
 * channel the bars use.
 */
function buildSpokenSummary({
  periodLabel,
  days,
  monthPaise,
  busiestDay,
  daysWithSpending,
}: {
  periodLabel: string;
  days: AnalyticsReport['days'];
  monthPaise: number;
  busiestDay: AnalyticsReport['busiestDay'];
  daysWithSpending: number;
}): string {
  const peak =
    busiestDay == null
      ? 'no spending recorded yet'
      : `busiest day ${formatShortDay(fromDateKey(busiestDay.dateKey))} at ${formatInr(busiestDay.totalPaise)}`;

  return `Daily spending for ${periodLabel}. ${formatInr(monthPaise)} across ${daysWithSpending} of the last ${days.length} days. Highest spending ${peak}.`;
}

const styles = StyleSheet.create({
  plot: {
    height: PLOT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  column: {
    flex: 1,
    /*
      A cap rather than a fixed width. Late in a month 31 columns are about 7pt
      wide and no cap applies; on the 3rd, three columns would otherwise stretch
      to nearly the full card and read as slabs. Capping them keeps one column
      one shape at every point in the month, and the row centres around the
      remainder.
    */
    maxWidth: 18,
    height: PLOT_HEIGHT,
    justifyContent: 'flex-end',
  },
  track: {
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    backgroundColor: glass.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: borders.subtle,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    backgroundColor: colors.accent,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  axisLabel: {
    flexShrink: 1,
  },
  footnote: {
    paddingTop: spacing.xxs,
  },
});