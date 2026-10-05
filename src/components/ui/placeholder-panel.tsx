import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export type PlaceholderPanelProps = {
  /** What this screen will contain once its phase lands. */
  description: string;
  testID?: string;
};

/**
 * Neutral in-progress note for screens that are intentionally not built yet.
 *
 * Phrased as product language rather than developer notes, and kept visually
 * quiet — a tab should not look broken or like a placeholder while it is
 * waiting for its data layer.
 */
export function PlaceholderPanel({ description, testID }: PlaceholderPanelProps) {
  return (
    <GlassSurface
      level="subtle"
      borderLevel="subtle"
      shadow="none"
      testID={testID}
    >
      <View style={styles.body}>
        <Text variant="body" tone="tertiary">
          {description}
        </Text>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
  },
});