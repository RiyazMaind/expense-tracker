import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { borders, colors, glass, radii, spacing, touchTarget } from '@/theme';

export type MonthSwitcherProps = {
  /** The month on screen, already formatted — "October 2026". */
  label: string;
  /** Whether a month exists before this one to step back to. */
  canGoBack: boolean;
  /** Whether a later month exists to step forward to. */
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  /**
   * Present only when the screen is showing a month other than the current one.
   * The label then becomes a button that returns to following the current month.
   */
  onReset?: () => void;
  testID?: string;
};

/**
 * The month the whole Home dashboard is scoped to.
 *
 * A three-part row: step back, the month itself, step forward. The screen owns
 * the bounds — this component only renders them — because only the screen knows
 * which months actually have data (`earliestMonthKey`) and where "now" is.
 *
 * The label doubles as the way back to the present: when a past month is shown
 * it is a button ("Back to this month"), and when the current month is shown it
 * is plain text. That keeps the row symmetric and gives browsing an escape that
 * does not depend on tapping forward one month at a time.
 *
 * Chevrons follow the calendar sheet's nav-button treatment (`glass.strong` on
 * `borders.default`) so two month navigation controls in the app read as one
 * family, and dim rather than disappear when at a bound — the disabled state
 * explains why there is nowhere to go, an absent control does not.
 */
export function MonthSwitcher({
  label,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReset,
  testID,
}: MonthSwitcherProps) {
  const browsing = onReset != null;

  return (
    <View style={styles.row} testID={testID}>
      <Pressable
        onPress={onBack}
        disabled={!canGoBack}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        accessibilityState={{ disabled: !canGoBack }}
        style={({ pressed }) => [
          styles.navButton,
          !canGoBack && styles.navButtonDisabled,
          canGoBack && pressed && styles.pressed,
        ]}
        testID="month-prev"
      >
        <Icon name="chevronLeft" size={18} color={colors.textSecondary} />
      </Pressable>

      {onReset != null ? (
        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel={`Showing ${label}. Back to this month.`}
          style={({ pressed }) => [styles.labelSlot, pressed && styles.pressed]}
          testID="month-label"
        >
          <Text variant="title3" tone={browsing ? 'accent' : 'primary'} center numberOfLines={1}>
            {label}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.labelSlot} testID="month-label">
          <Text variant="title3" center numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}

      <Pressable
        onPress={onForward}
        disabled={!canGoForward}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: !canGoForward }}
        style={({ pressed }) => [
          styles.navButton,
          !canGoForward && styles.navButtonDisabled,
          canGoForward && pressed && styles.pressed,
        ]}
        testID="month-next"
      >
        <Icon name="chevronRight" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: glass.strong,
    borderWidth: 1,
    borderColor: borders.default,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  labelSlot: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
});
