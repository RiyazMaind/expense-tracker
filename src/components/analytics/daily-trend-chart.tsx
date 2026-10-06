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

/** Plot area height in points: amount row, bars and weekly ticks. */
const PLOT_HEIGHT = 104;

/** Date ticks land on the 1st, 8th, 15th, 22nd and 29th — a weekly grid that never drifts. */
const TICK_STRIDE = 7;

/** Bar fill for ordinary days. Muted so the busiest day owns the accent. */
const BAR_QUIET = 'rgba(108, 123, 255, 0.38)';

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
 * distorting anything. The busiest day owns the full accent and an amount label;
 * every other day sits back in a muted accent so the peak reads first.
 */
export function DailyTrendChart({
  periodLabel,
  days,
  monthPaise,
  busiestDay,
  daysWithSpending,
  testID,
}: DailyTrendChartProps) {
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
        {days.map((day) => {
          const isBusiest = busiestDay != null && day.dateKey === busiestDay.dateKey;

          return (
            <View
              key={day.dateKey}
              style={styles.column}
              testID={`analytics-trend-day-${day.dayOfMonth}`}
            >
              {/*
                The slot reserves the height whether or not this day carries
                the amount, so the bars in every column share one baseline
                even before the label appears.
              */}
              <View style={styles.peakSlot}>
                {isBusiest ? (
                  <Text
                    variant="micro"
                    tone="accent"
                    tabular
                    style={styles.peakLabel}
                    numberOfLines={1}
                    ellipsizeMode="clip"
                    testID="analytics-trend-peak"
                  >
                    {formatInr(day.totalPaise)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.trackArea}>
                <View style={styles.track}>
                  {day.totalPaise > 0 ? (
                    <View
                      style={[
                        styles.bar,
                        isBusiest ? styles.barPeak : styles.barQuiet,
                        // 2% floor: a day whose share rounds to 0% still has to
                        // leave a hairline, or "some activity" reads as "none".
                        { height: `${Math.max(2, Math.round(day.height * 100))}%` },
                      ]}
                      testID={`analytics-trend-bar-${day.dayOfMonth}`}
                    />
                  ) : null}
                </View>
              </View>

              {/*
                Weekly ticks under the plot: a two-digit day number is wider than
                a column, so every column keeps an oversized, centred label and
                only the weekly ones have ink. Labelling all 31 would overlap;
                labelling only first/middle/last would hide where "mid-month"
                sits after the window clips to today.
              */}
              <Text
                variant="micro"
                tone={isBusiest ? 'accent' : 'tertiary'}
                tabular
                style={[styles.tick, isBusiest && styles.tickPeak]}
                numberOfLines={1}
                ellipsizeMode="clip"
              >
                {(day.dayOfMonth - 1) % TICK_STRIDE === 0 ? String(day.dayOfMonth) : ''}
              </Text>
            </View>
          );
        })}
      </View>

      <Text
        variant="caption"
        tone="secondary"
        style={styles.footnote}
        testID="analytics-busiest"
      >
        {busiestDaySummary(busiestDay)}
      </Text>
    </GlassCard>
  );
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
    alignItems: 'stretch',
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
    alignItems: 'center',
  },
  trackArea: {
    flex: 1,
    width: '100%',
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
  },
  barQuiet: {
    backgroundColor: BAR_QUIET,
  },
  barPeak: {
    backgroundColor: colors.accent,
  },
  /**
   * Reserved amount-label row. Height is paid for by every column so the
   * bars keep one baseline; only the busiest column renders ink in it. The
   * label is deliberately wider than its column and allowed to overflow —
   * the surrounding columns are quiet at the peak — so the amount never
   * wraps.
   */
  peakSlot: {
    height: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  peakLabel: {
    width: 56,
    textAlign: 'center',
  },
  /**
   * Weekly ticks. Each label is wider than its column (see above), so it is
   * centred and allowed to overflow — the ticks are a week apart, so the ink
   * never collides.
   */
  tick: {
    width: 32,
    textAlign: 'center',
    paddingTop: spacing.xs,
  },
  tickPeak: {
    fontWeight: '700',
  },
  footnote: {
    paddingTop: spacing.sm,
  },
});
