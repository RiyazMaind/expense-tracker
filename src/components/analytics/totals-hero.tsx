import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/glass/glass-card';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';
import { formatInr } from '@/utils/currency';

export type TotalsHeroProps = {
  /** What the amount covers, e.g. "Spent in October". */
  label: string;
  /** Whole paise. */
  amountPaise: number;
  /** One supporting line under the amount. */
  caption: string;
  testID?: string;
};

/**
 * The one figure Analytics is about.
 *
 * docs/design-system.md puts large amounts at the top of the hierarchy, and the
 * dashboard already established the treatment for this exact card: a hero amount
 * in `display` inside an unpadded `GlassCard`, so nothing competes with it. This
 * is that card again, on the screen whose whole reason for existing is a
 * number — everything below it is context for the amount at the top.
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
      accessibilityLabel={`${label}: ${amount}. ${caption}`}
    >
      <View style={styles.body}>
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
        {/*
          No `numberOfLines`. A seven-figure rupee amount is wider than 360dp at
          44pt, and truncating an amount — with an ellipsis in the middle of the
          digits — is the one outcome that must never happen on a finance screen.
          Wrapping keeps every digit on screen.
        */}
        <Text variant="display" tabular testID="analytics-hero-amount">
          {amount}
        </Text>
        <Text variant="caption" tone="tertiary">
          {caption}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
});