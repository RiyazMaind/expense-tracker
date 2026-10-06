import { StyleSheet, View } from 'react-native';

import { BudgetProgressBar } from '@/components/budget/budget-progress-bar';
import { GlassCard } from '@/components/glass/glass-card';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';
import { formatMonthKey, type BudgetOutlook } from '@/utils/budget';
import { formatInr } from '@/utils/currency';

export type BudgetInsightProps = {
  /** The month's budget analytics, computed from the plan and the spending. */
  outlook: BudgetOutlook;
  /** `YYYY-MM` key the outlook describes, for the heading. */
  monthKey: string;
  testID?: string;
};

/** The three semantic verdicts this card can carry. */
type PaceTone = 'positive' | 'warning' | 'destructive';

/** Tint behind the pace pill — the semantic colour at low alpha, never a solid block. */
const paceTint: Record<PaceTone, string> = {
  positive: 'rgba(52, 211, 153, 0.14)',
  warning: 'rgba(251, 191, 36, 0.14)',
  destructive: 'rgba(248, 113, 113, 0.14)',
};

const paceColor: Record<PaceTone, string> = {
  positive: colors.positive,
  warning: colors.warning,
  destructive: colors.destructive,
};

/**
 * Budget progress, on the dashboard that carries every other period figure.
 *
 * One reading order, strongest to weakest — docs/design-system.md: "Large
 * amounts are the most important numbers on the screen" and "clear amount
 * hierarchy":
 *
 * 1. the remaining figure owns a `headline`, with the percentage quietly
 *    beside it;
 * 2. the month and the budget it is measured against frame it in the subtitle;
 * 3. the two forward-looking metrics drop to muted `body` under micro labels;
 * 4. the pace verdict is a compact tinted pill, not a full-width sentence.
 *
 * The bar is deliberately a hairline: it is the evidence for the number above
 * it, not a second focal point (glassmorphism-design: one loudest thing per
 * surface). Card padding tightens to `spacing.md` vertically via
 * `contentStyle`, because a gauge does not need the breathing room a content
 * card does.
 *
 * Presentational only: the outlook arrives fully computed, so this component
 * holds no arithmetic beyond `Math.round` for display
 * (docs/architecture.md — components for presentation).
 */
export function BudgetInsight({ outlook, monthKey, testID }: BudgetInsightProps) {
  const { progress } = outlook;
  const percentUsed = Math.round(progress.percentUsed);
  const nearlySpent = !progress.exceeded && progress.percentUsed >= 80;
  const pace = paceVerdict(outlook);

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
      accessibilityLabel={`Budget progress for ${monthLabel}. ${amount}, ${percentUsed} percent used. ${pace.spoken}`}
    >
      {/*
        The card's own number: the remainder at `headline`, with the uncapped
        percentage held back to a muted caption on the same baseline so the row
        stays one line tall.
      */}
      <View style={styles.primaryRow}>
        <Text
          variant="headline"
          tabular
          tone={progress.exceeded ? 'destructive' : 'primary'}
          accessibilityLiveRegion="polite"
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

      {/*
        The two forward-looking numbers in equal columns, edges aligned —
        labels on one line, values tabular, both deliberately quieter than the
        figure above: they inform the decision, they do not make it.
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
          <Text variant="body" tabular tone="secondary" numberOfLines={1}>
            {formatInr(outlook.dailyAllowancePaise)}
          </Text>
        </View>

        <View
          style={[styles.metric, styles.metricTrailing]}
          accessible
          accessibilityLabel={`Projected spend this month: ${formatInr(outlook.projectedPaise)}`}
          testID={testID ? `${testID}-projection` : undefined}
        >
          <Text variant="micro" tone="tertiary" numberOfLines={1}>
            Projected spend
          </Text>
          <Text variant="body" tabular tone="secondary" numberOfLines={1}>
            {formatInr(outlook.projectedPaise)}
          </Text>
        </View>
      </View>

      {/*
        The verdict as a pill: one short line on a low-alpha tint of its own
        semantic colour, sized to its text instead of spanning the card. The
        written verdict carries the meaning, so colour is never the only cue.
      */}
      <View
        style={[styles.pace, { backgroundColor: paceTint[pace.tone] }]}
        accessible
        accessibilityLabel={pace.spoken}
        testID={testID ? `${testID}-pace` : undefined}
      >
        <View style={[styles.paceDot, { backgroundColor: paceColor[pace.tone] }]} />
        <Text variant="micro" tone={pace.tone} style={styles.paceText}>
          {pace.text}
        </Text>
      </View>
    </GlassCard>
  );
}

/**
 * The projection as a pill line: which side of the budget the pace lands on,
 * by how much, and how much of the month is left to change it.
 *
 * `text` is the compact on-screen form; `spoken` keeps the full sentence for
 * assistive tech, which gains nothing from the compaction.
 */
function paceVerdict(outlook: BudgetOutlook): {
  text: string;
  spoken: string;
  tone: PaceTone;
} {
  const days = outlook.daysRemaining;
  const dayLabel = `${days} ${days === 1 ? 'day' : 'days'} left`;
  const gap = formatInr(Math.abs(outlook.projectedGapPaise));
  const side = outlook.projectedExceeded ? 'over' : 'under';

  return {
    text: `Month ends ${gap} ${side} · ${dayLabel}`,
    spoken: `At this pace the month ends ${gap} ${side} the budget. ${dayLabel}.`,
    tone: paceTone(outlook),
  };
}

/** Warning while there is still time to change course; destructive once over. */
function paceTone(outlook: BudgetOutlook): PaceTone {
  if (outlook.progress.exceeded) {
    return 'destructive';
  }

  return outlook.projectedExceeded ? 'warning' : 'positive';
}

const styles = StyleSheet.create({
  // Vertical padding one step below the shared `spacing.lg`; the header's own
  // gap plus this gap is what spaces the sections, so no per-section padding.
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
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metric: {
    flex: 1,
    gap: spacing.xxs,
  },
  metricTrailing: {
    // Second column locks to the card's right edge so the pair reads as one
    // aligned row rather than two independent stacks.
    alignItems: 'flex-end',
  },
  pace: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  paceDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  paceText: {
    fontWeight: '700',
  },
});
