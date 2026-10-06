import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface, type GlassSurfaceProps } from '@/components/glass/glass-surface';
import { Text } from '@/components/ui/text';
import { radii, spacing, type GlassLevel } from '@/theme';

export type GlassCardProps = PropsWithChildren<{
  /** Optional heading rendered above the card content. */
  title?: string;
  /** Supporting line under the heading. */
  subtitle?: string;
  level?: GlassLevel;
  /** Extra padding inside the card. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Overrides for the inner content column, applied after the padding and gap
   * defaults. Lets a dense card tighten its own vertical rhythm without the
   * shared card growing per-instance padding variants.
   */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}> &
  Pick<GlassSurfaceProps, 'radius' | 'shadow' | 'highlighted' | 'solid'>;

/**
 * A grouped content surface.
 *
 * docs/design-system.md: "Cards should communicate meaningful grouping. Do not
 * create cards simply to fill space." Use this when a set of values genuinely
 * belongs together; use a bare `GlassSurface` for one-off panels.
 */
export function GlassCard({
  children,
  title,
  subtitle,
  level = 'default',
  padded = true,
  style,
  contentStyle,
  testID,
  accessibilityLabel,
  radius = radii.lg,
  shadow = 'md',
  highlighted = true,
  solid = false,
}: GlassCardProps) {
  const hasHeader = typeof title === 'string' || typeof subtitle === 'string';

  return (
    <GlassSurface
      level={level}
      radius={radius}
      shadow={shadow}
      highlighted={highlighted}
      solid={solid}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <View style={[styles.inner, padded && styles.padded, contentStyle]}>
        {hasHeader ? (
          <View style={styles.header}>
            {typeof title === 'string' ? (
              <Text variant="label" tone="secondary">
                {title}
              </Text>
            ) : null}
            {typeof subtitle === 'string' ? (
              <Text variant="body" tone="secondary">
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
        {children}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    gap: spacing.sm,
  },
  padded: {
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xxs,
    paddingBottom: spacing.xs,
  },
});