import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export type EmptyStateProps = {
  title: string;
  body: string;
  /** Primary action, rendered under the copy. */
  action?: React.ReactNode;
  testID?: string;
};

/**
 * First-use empty state.
 *
 * docs/screens.md requires the empty state to be intentional — "Do not show an
 * empty chart with no explanation." It also sets a quality bar: no jargon, no
 * apologising, and a clear next step. Deliberately restrained so the screen
 * still reads as a real expense tracker rather than a marketing panel.
 */
export function EmptyState({ title, body, action, testID }: EmptyStateProps) {
  return (
    <GlassSurface
      level="subtle"
      borderLevel="subtle"
      shadow="sm"
      testID={testID}
      accessibilityLabel={`${title}. ${body}`}
    >
      <View style={styles.body}>
        <Text variant="title3">{title}</Text>
        <Text variant="body" tone="secondary">
          {body}
        </Text>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  action: {
    paddingTop: spacing.sm,
  },
});