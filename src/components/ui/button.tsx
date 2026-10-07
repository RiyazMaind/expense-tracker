import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Text, type TextTone } from '@/components/ui/text';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { colors, easing, motion, radii, spacing, touchTarget } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type GlassButtonProps = {
  children?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  /** Fires a light impact on press. Off for low-emphasis actions. */
  haptic?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The app's action control.
 *
 * Variant choices follow docs/design-system.md: "Primary actions should be
 * more visually solid than background glass. The Add Expense action must be
 * immediately recognizable." So `primary` is a solid accent fill, not glass.
 * `secondary` and `ghost` are glass.
 *
 * Uses compound components (Button / ButtonLabel / ButtonIcon) rather than
 * polymorphic children
 * (vercel-react-native-skills/rules/design-system-compound-components.md).
 */
export function GlassButton({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  block = false,
  haptic = true,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: GlassButtonProps) {
  const reduceMotion = useReducedMotion();

  // Ground truth is `pressed`; scale is derived. Animating transform + opacity
  // keeps this on the GPU (animation-gpu-properties).
  const pressed = useSharedValue(0);
  const blocked = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pressed.get(), [0, 1], [1, 0.97]) },
    ],
    opacity: interpolate(pressed.get(), [0, 1], [1, 0.9]),
  }));

  const handlePress = () => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // Haptics are unavailable on web and some devices. Never block the tap.
      });
    }
    onPress?.();
  };

  const minHeight =
    size === 'lg'
      ? 54
      : size === 'sm'
        ? touchTarget.min
        : touchTarget.min + 4;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: blocked, busy: loading }}
      // Widens the touch area without changing layout, for small controls.
      hitSlop={size === 'sm' ? 8 : 0}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: motion.instant, easing: easing.standard }));
      }}
      onPressOut={() => {
        pressed.set(
          withTiming(0, {
            // Honour reduce-motion: snap back instead of animating.
            duration: reduceMotion ? 0 : motion.fast,
            easing: easing.standard,
          })
        );
      }}
      style={({ pressed: isPressed }) => [
        styles.pressable,
        block && styles.block,
        isPressed && styles.pressedOverlay,
        style,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <ButtonBackground variant={variant} disabled={blocked} minHeight={minHeight}>
          {loading ? (
            <ActivityIndicator
              color={variant === 'primary' ? colors.textOnAccent : colors.text}
            />
          ) : (
            children
          )}
        </ButtonBackground>
      </Animated.View>
    </Pressable>
  );
}

/** Visual body of the button. Split out so press scaling wraps a stable node. */
function ButtonBackground({
  variant,
  disabled,
  minHeight,
  children,
}: {
  variant: ButtonVariant;
  disabled: boolean;
  minHeight: number;
  children: ReactNode;
}) {
  const isSolid = variant === 'primary' || variant === 'destructive';

  const solidBackground =
    variant === 'primary'
      ? colors.accent
      : variant === 'destructive'
        ? colors.destructive
        : undefined;

  if (variant === 'ghost') {
    return (
      <View
        style={[
          styles.ghost,
          styles.contentRow,
          { minHeight, borderRadius: radii.pill },
          disabled && styles.disabled,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <GlassSurface
      level="default"
      radius={radii.pill}
      shadow={isSolid ? 'md' : 'sm'}
      solid={isSolid}
      blurred={!isSolid}
      highlighted={!isSolid}
      style={[
        styles.background,
        { minHeight },
        isSolid && { backgroundColor: solidBackground },
        disabled && styles.disabled,
      ]}
    >
      {/*
        GlassSurface lays its content out as a column, which put the icon on
        its own line above a full-width label. This row puts the icon inline
        before the label and centres the pair, which is what a compound
        icon + text button is supposed to read as.
      */}
      <View style={styles.contentRow}>{children}</View>
    </GlassSurface>
  );
}

/** Text content of a button. */
export function ButtonLabel({
  children,
  variant = 'primary',
}: {
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  const tone: TextTone =
    variant === 'primary' || variant === 'destructive' ? 'onAccent' : 'primary';
  return (
    <Text variant="body" tone={tone} center style={styles.label}>
      {children}
    </Text>
  );
}

/** Leading icon slot. Kept separate so button children stay unambiguous. */
export function ButtonIcon({ children }: { children: ReactNode }) {
  return <View style={styles.icon}>{children}</View>;
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
  },
  block: {
    alignSelf: 'stretch',
  },
  pressedOverlay: {
    opacity: 0.92,
  },
  background: {
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  /** One centred line for icon + label, and for the spinner on its own. */
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontWeight: '600',
  },
  icon: {
    marginRight: spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
});