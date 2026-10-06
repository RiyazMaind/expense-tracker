import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/glass/glass-card';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';
import { formatInr } from '@/utils/currency';

export type TotalsHeroProps = {
  /** What the amount covers, e.g. "Spent in October". */
  label: string;
  /** Whole paise. */
  amountPaise: number;
  /**
   * One supporting line under the amount.
   *
   * Optional because it is derived from data that can still be loading. Omitting
   * it drops the line rather than rendering an empty one, so the card settles
   * into its final height once, instead of reserving a blank row first.
   */
  caption?: string;
  testID?: string;
};

/**
 * The one figure the screen is about.
 *
 * docs/design-system.md puts large amounts at the top of the hierarchy: a hero
 * amount in `display` inside an unpadded `GlassCard`, so nothing competes with
 * it, and everything below it is context for the amount at the top. Home uses it
 * for the month total — the number the budget is measured against.
 *
 * Only one hero per screen, and it is never shared with a second card: a second
 * amount at `display` would make the screen say two things loudly at once
 * (glassmorphism-design: glass should not be applied just to fill space).
 */
export function TotalsHero({ label, amountPaise, caption, testID }: TotalsHeroProps) {
  const amount = formatInr(amountPaise);

  return (
    <GlassCard
      padded={false}
      testID={testID}
      /*
        One sentence for the whole card. Left to the default, a screen reader
        would read the label, the amount and the caption as three disconnected
        fragments with no indication that they are one figure.
      */
      accessibilityLabel={`${label}: ${amount}.${caption == null ? '' : ` ${caption}`}`}
    >
      <View style={styles.topSheen} />
      <View style={styles.glowBackdrop} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.heroTag}>
            <View style={styles.tagDot} />
            <Text variant="caption" tone="secondary" style={styles.tagText}>
              MONTHLY TOTAL
            </Text>
          </View>
        </View>

        {/*
          No `numberOfLines`. A seven-figure rupee amount is wider than 360dp at
          44pt, and truncating an amount — with an ellipsis in the middle of the
          digits — is the one outcome that must never happen on a finance screen.
          Wrapping keeps every digit on screen.
        */}
        <Text variant="display" tabular testID="hero-amount">
          {amount}
        </Text>

        {typeof caption === 'string' ? (
          <Text variant="caption" tone="tertiary">
            {caption}
          </Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  topSheen: {
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.7,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  glowBackdrop: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(108, 123, 255, 0.08)',
  },
  body: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(108, 123, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108, 123, 255, 0.28)',
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.accent,
  },
});