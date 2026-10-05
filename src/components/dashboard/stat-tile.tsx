import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export type StatTileProps = {
  /** Period label, e.g. "This week". */
  label: string;
  /** Pre-formatted amount, e.g. "₹0". */
  value: string;
  testID?: string;
};

/**
 * A secondary period total (this week, this month).
 *
 * Kept visually lighter than the hero amount so the dashboard has one clear
 * focal point — docs/design-system.md: "Large amounts are the most important
 * numbers on the screen."
 */
export function StatTile({ label, value, testID }: StatTileProps) {
  return (
    <GlassSurface
      level="subtle"
      borderLevel="subtle"
      shadow="sm"
      style={styles.surface}
      testID={testID}
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.body}>
        {/*
         * `label`, not the uppercase overline: at 11pt in the tertiary tone this
         * measured 3.9:1 against the tile fill, and three blocks of capitals on
         * one dashboard is the "excessive uppercase" the design language avoids.
         */}
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="headline" tabular numberOfLines={1}>
          {value}
        </Text>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
  },
  body: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
});