import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing } from '@/theme';

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
      <View style={styles.topSheen} />
      <View style={styles.body}>
        <View style={styles.labelRow}>
          <View style={styles.accentDot} />
          <Text variant="label" tone="secondary" numberOfLines={1} style={styles.labelText}>
            {label}
          </Text>
        </View>
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
    overflow: 'hidden',
  },
  topSheen: {
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
  },
  body: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentSecondary,
    opacity: 0.8,
  },
  labelText: {
    flex: 1,
  },
});