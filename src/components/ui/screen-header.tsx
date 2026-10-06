import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned slot for a header action. */
  action?: React.ReactNode;
  testID?: string;
};

/** Page title block. Keeps heading hierarchy consistent across screens. */
export function ScreenHeader({ title, subtitle, action, testID }: ScreenHeaderProps) {
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
        </View>
        {typeof subtitle === 'string' ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});