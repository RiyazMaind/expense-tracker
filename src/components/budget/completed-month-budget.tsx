import { StyleSheet, View } from 'react-native';

import { BudgetProgressBar } from '@/components/budget/budget-progress-bar';
import { GlassCard } from '@/components/glass/glass-card';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';
import { formatMonthKey, type BudgetOutlook } from '@/utils/budget';
import { formatInr } from '@/utils/currency';

export type CompletedMonthBudgetProps = {
  /** The month's outlook, computed against that month's own last day. */
  outlook: BudgetOutlook;
  /** `YYYY-MM` key the outlook describes, for the heading. */
  monthKey: string;
  testID?: string;
};

/** The two verdicts a finished month can carry. */
type VerdictTone = 'positive' | 'destructive';

/** Tint behind the verdict pill — the semantic colour at low alpha, as in BudgetInsight. */
const verdictTint: Record<VerdictTone, string> = {
  positive: 'rgba(52, 211, 153, 0.14)',
  destructive: 'rgba(248, 113, 113, 0.14)',
};

const verdictColor: Record<VerdictTone, string> = {
  positive: colors.positive,
  destructive: colors.destructive,
};

/**
 * How a *completed* month's budget reads.
 *
 * `BudgetInsight` forecasts — "Month ends ₹X under · N days left" — which is
 * the truth only while the month is still running. On a month the user browses
 * back to, every day has already happened, so this card states the outcome
 * instead: the bar as it landed, what remained, and which side of the plan the
 * month finished on. The reading order mirrors the insight (amount, bar,
 * verdict) so the two cards read as one object in two tenses.
 *
 * Presentational: the outlook arrives computed against the month's own last
 * day, so `daysRemaining` is 1 and the projection equals the actual — neither
 * is shown, and no arithmetic runs beyond `Math.round` for display
 * (docs/architecture.md — components for presentation).
 */
export function CompletedMonthBudget({ outlook, monthKey, testID }: CompletedMonthBudgetProps) {
  const { progress } = outlook;
  const percentUsed = Math.round(progress.percentUsed);
  const nearlySpent = !progress.exceeded && progress.percentUsed >= 80;
  const verdict = monthVerdict(progress.remainingPaise);

  const monthLabel = formatMonthKey(monthKey);
  const amount = progress.exceeded
    ? `${formatInr(-progress.remainingPaise)} over`
    : `${formatInr(progress.remainingPaise)} left`;

  return (
    <GlassCard
      title="Budget progress"
      subtitle={`${monthLabel} · ${formatInr(progress.budgetPaise)} budget`}
      contentStyle={styles.content}
      testID={testID}
      accessibilityLabel={`Budget progress for ${monthLabel}. ${amount}, ${percentUsed} percent used. ${verdict.spoken}`}
    >
      <View style={styles.primaryRow}>
        <Text
          variant="headline"
          tabular
          tone={progress.exceeded ? 'destructive' : 'primary'}
          testID={testID ? `${testID}-remaining` : undefined}
        >
          {amount}
        </Text>
        <Text variant="caption" tone="tertiary" tabular>
          {`${percentUsed}% used`}
        </Text>
      </View>

      <BudgetProgressBar
        fraction={progress.visualFraction}
        exceeded={progress.exceeded}
        nearlySpent={nearlySpent}
        thickness={6}
        accessibilityLabel="Budget used"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.min(100, Math.round(progress.percentUsed)),
          text: `${percentUsed} percent of your budget used`,
        }}
        testID={testID ? `${testID}-bar` : undefined}
      />

      <View
        style={[styles.verdict, { backgroundColor: verdictTint[verdict.tone] }]}
        accessible
        accessibilityLabel={verdict.spoken}
        testID={testID ? `${testID}-verdict` : undefined}
      >
        <View style={[styles.verdictDot, { backgroundColor: verdictColor[verdict.tone] }]} />
        <Text variant="micro" tone={verdict.tone} style={styles.verdictText}>
          {verdict.text}
        </Text>
      </View>
    </GlassCard>
  );
}

/**
 * The side of the plan the month finished on, from the remainder alone.
 *
 * Derived, not forecast: the remainder is `budget − spent` for a month whose
 * every day has already been counted, so there is no pace to extrapolate and no
 * days left to change it.
 */
function monthVerdict(remainingPaise: number): {
  text: string;
  spoken: string;
  tone: VerdictTone;
} {
  if (remainingPaise < 0) {
    const gap = formatInr(-remainingPaise);

    return {
      text: `Month ended ${gap} over budget`,
      spoken: `The month ended ${gap} over the budget.`,
      tone: 'destructive',
    };
  }

  if (remainingPaise > 0) {
    const gap = formatInr(remainingPaise);

    return {
      text: `Month ended ${gap} under budget`,
      spoken: `The month ended ${gap} under the budget.`,
      tone: 'positive',
    };
  }

  return {
    text: 'Month ended exactly on budget',
    spoken: 'The month ended exactly on the budget.',
    tone: 'positive',
  };
}

const styles = StyleSheet.create({
  // Same tightened rhythm as BudgetInsight: a gauge does not need the
  // breathing room a content card does.
  content: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  verdictDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  verdictText: {
    fontWeight: '700',
  },
});
