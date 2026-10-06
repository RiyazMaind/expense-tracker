import { StyleSheet, View } from 'react-native';

import { BudgetProgressBar } from '@/components/budget/budget-progress-bar';
import { GlassCard } from '@/components/glass/glass-card';
import { Text, type TextTone } from '@/components/ui/text';
import { spacing } from '@/theme';
import { formatMonthKey, type BudgetOutlook } from '@/utils/budget';
import { formatInr } from '@/utils/currency';

export type BudgetInsightProps = {
  /** The month's budget analytics, computed from the plan and the spending. */
  outlook: BudgetOutlook;
  /** `YYYY-MM` key the outlook describes, for the heading. */
  monthKey: string;
  testID?: string;
};

/**
 * Budget progress, on the dashboard that carries every other period figure.
 *
 * The same three questions the Budget screen answers — how much is used, how
 * much is left, are we over — plus the two a home screen exists to answer
 * ahead of time: what is safe to spend today, and where the month is heading
 * if the pace holds. docs/screens.md lists "Budget progress" as dashboard
 * content, and docs/data-model.md requires the visual bar to cap at 100% while
 * the stated percentage keeps counting past it, which is exactly what
 * `BudgetProgressBar` + `computeBudgetOutlook` do here.
 *
 * Presentational only: the outlook arrives fully computed, so this component
 * holds no arithmetic beyond `Math.round` for display
 * (docs/architecture.md — components for presentation).
 */
export function BudgetInsight({ outlook, monthKey, testID }: BudgetInsightProps) {
  const { progress } = outlook;
  const percentUsed = Math.round(progress.percentUsed);
  const nearlySpent = !progress.exceeded && progress.percentUsed >= 80;

  return (
    <GlassCard
      title="Budget progress"
      subtitle={`${formatMonthKey(monthKey)} · ${percentUsed}% used`}
      testID={testID}
      accessibilityLabel={`Budget progress for ${formatMonthKey(monthKey)}. ${percentUsed} percent used. ${
        progress.exceeded
          ? `Over budget by ${formatInr(-progress.remainingPaise)}.`
          : `${formatInr(progress.remainingPaise)} left.`
      } ${paceSummary(outlook)}`}
    >
      <BudgetProgressBar
        fraction={progress.visualFraction}
        exceeded={progress.exceeded}
        nearlySpent={nearlySpent}
        accessibilityLabel="Budget used"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.min(100, Math.round(progress.percentUsed)),
          text: `${percentUsed} percent of your budget used`,
        }}
        testID={testID ? `${testID}-bar` : undefined}
      />

      <Text
        variant="caption"
        tone={progress.exceeded ? 'destructive' : 'secondary'}
        accessibilityLiveRegion="polite"
        testID={testID ? `${testID}-remaining` : undefined}
      >
        {progress.exceeded
          ? `Over budget by ${formatInr(-progress.remainingPaise)}`
          : `${formatInr(progress.remainingPaise)} left of ${formatInr(progress.budgetPaise)}`}
      </Text>

      {/*
        The two forward-looking numbers, side by side: what today may cost and
        what the month looks like from here. They are the reason this card is
        on the dashboard rather than only on the Budget screen — one restates
        the bar above, the other answers "am I going to make it".
      */}
      <View style={styles.metrics}>
        <View
          style={styles.metric}
          accessible
          accessibilityLabel={`Safe to spend per day: ${formatInr(outlook.dailyAllowancePaise)}`}
          testID={testID ? `${testID}-allowance` : undefined}
        >
          <Text variant="micro" tone="tertiary" numberOfLines={1}>
            Safe to spend/day
          </Text>
          <Text variant="title3" tabular numberOfLines={1}>
            {formatInr(outlook.dailyAllowancePaise)}
          </Text>
        </View>

        <View
          style={styles.metric}
          accessible
          accessibilityLabel={`Projected spend this month: ${formatInr(outlook.projectedPaise)}`}
          testID={testID ? `${testID}-projection` : undefined}
        >
          <Text variant="micro" tone="tertiary" numberOfLines={1}>
            Projected spend
          </Text>
          <Text
            variant="title3"
            tabular
            tone={outlook.projectedExceeded ? 'warning' : 'positive'}
            numberOfLines={1}
          >
            {formatInr(outlook.projectedPaise)}
          </Text>
        </View>
      </View>

      <Text
        variant="caption"
        tone={paceTone(outlook)}
        testID={testID ? `${testID}-pace` : undefined}
      >
        {paceSummary(outlook)}
      </Text>
    </GlassCard>
  );
}

/**
 * The projection as one sentence: which side of the budget the pace lands on,
 * by how much, and how much of the month is left to change it.
 */
function paceSummary(outlook: BudgetOutlook): string {
  const days = outlook.daysRemaining;
  const dayLabel = `${days} ${days === 1 ? 'day' : 'days'} left`;

  return outlook.projectedExceeded
    ? `At this pace the month ends ${formatInr(outlook.projectedGapPaise)} over · ${dayLabel}`
    : `At this pace the month ends ${formatInr(-outlook.projectedGapPaise)} under · ${dayLabel}`;
}

/** Warning while there is still time to change course; destructive once over. */
function paceTone(outlook: BudgetOutlook): TextTone {
  if (outlook.progress.exceeded) {
    return 'destructive';
  }

  return outlook.projectedExceeded ? 'warning' : 'positive';
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  metric: {
    flex: 1,
    gap: spacing.xxs,
  },
});
