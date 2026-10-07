import { useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { GlassSurface } from "@/components/glass/glass-surface";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { blur, colors, fontWeight, motion, radii, touchTarget } from "@/theme";

/* -------------------------------------------------------------------------- */
/* Navigation definitions                                                     */
/* -------------------------------------------------------------------------- */

export type TabDefinition = {
  name: string;
  href: Href;
  label: string;
  icon: IconName;
};

export const homeTab: TabDefinition = {
  name: "index",
  href: "/",
  label: "Home",
  icon: "home",
};

export const expensesTab: TabDefinition = {
  name: "expenses",
  href: "/expenses",
  label: "Expenses",
  icon: "receipt",
};

export const tabs: readonly [TabDefinition, TabDefinition] = [
  homeTab,
  expensesTab,
];

/* -------------------------------------------------------------------------- */
/* Layout metrics                                                             */
/* -------------------------------------------------------------------------- */

const HEIGHT = 64;
const HORIZONTAL_MARGIN = 16;
const ICON_SIZE = 20;
const ICON_LABEL_GAP = 3;

/**
 * Shared absolute positioning for the floating navbar.
 */
export const navBarPosition: ViewStyle = {
  position: "absolute",
  left: HORIZONTAL_MARGIN,
  right: HORIZONTAL_MARGIN,
};

/**
 * Layout for the transparent touch row that sits over the glass surface.
 *
 * No horizontal padding: `navBarPosition` already insets both the surface and
 * this row by the same amount, so padding here as well would double the inset
 * on the touches while leaving the glass where it is. Transparent, because the
 * glass surface below provides the material — this row only exists to lay out
 * items and receive touches.
 */
export const navListStyle: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  height: HEIGHT,
  paddingHorizontal: 0,
  backgroundColor: "transparent",
  borderRadius: radii.pill,
};

/* -------------------------------------------------------------------------- */
/* Active Tab Indicator                                                       */
/* -------------------------------------------------------------------------- */

export function ActiveTabIndicator({
  activeIndex = 0,
}: {
  activeIndex?: number;
}) {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);

  const slotWidth = width > 0 ? (width - 12) / 3 : 0;
  const targetX = activeIndex === 0 ? 6 : 6 + slotWidth * 2;

  useEffect(() => {
    if (width > 0) {
      if (reduceMotion) {
        translateX.set(targetX);
      } else {
        translateX.set(
          withSpring(targetX, {
            damping: 18,
            stiffness: 190,
            mass: 0.8,
          }),
        );
      }
    }
  }, [activeIndex, reduceMotion, targetX, translateX, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
    width: slotWidth,
    opacity: width > 0 ? 1 : 0,
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      pointerEvents="none"
    >
      {width > 0 && (
        <Animated.View style={[styles.indicatorPill, animatedStyle]} />
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Glass surface                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The floating glass surface every bottom bar is made of.
 *
 * `activeIndex` is which of the outer thirds the indicator pill sits in.
 * Pass `null` on a screen that is not a tab (Settings) — the pill hides
 * instead of claiming a slot that is not focused.
 */
export function GlassNavBar({
  style,
  activeIndex = 0,
}: {
  style?: StyleProp<ViewStyle>;
  activeIndex?: number | null;
}) {
  return (
    <GlassSurface
      level="strong"
      borderLevel="strong"
      radius={radii.pill}
      intensity={blur.navigation}
      shadow="md"
      highlighted
      style={[styles.bar, style]}
      testID="glass-nav-bar"
    >
      {activeIndex !== null && <ActiveTabIndicator activeIndex={activeIndex} />}
    </GlassSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Standard navigation item                                                   */
/* -------------------------------------------------------------------------- */

export type NavItemProps = {
  name: string;
  label: string;
  icon: IconName;
  isFocused?: boolean;
  onPress?: (event: unknown) => void;
  onLongPress?: (event: unknown) => void;
  href?: unknown;
  style?: StyleProp<ViewStyle>;
};

export function NavItem({
  name,
  label,
  icon,
  isFocused,
  onPress,
  onLongPress,
  style,
}: NavItemProps) {
  const reduceMotion = useReducedMotion();
  const selected = isFocused ?? false;

  const pressed = useSharedValue(0);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(pressed.get() ? 0.6 : 1, {
      duration: reduceMotion ? 0 : motion.instant,
    }),
    transform: [
      {
        scale: withTiming(pressed.get() ? 0.94 : 1, {
          duration: reduceMotion ? 0 : motion.instant,
        }),
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: reduceMotion
          ? selected
            ? 1.08
            : 1.0
          : withSpring(selected ? 1.14 : 1.0, {
              damping: 14,
              stiffness: 180,
            }),
      },
    ],
  }));

  const handlePress = (
    event: Parameters<NonNullable<NavItemProps["onPress"]>>[0],
  ) => {
    if (!selected) {
      Haptics.selectionAsync().catch(() => {});
    }

    onPress?.(event);
  };

  const iconColor = selected ? colors.text : colors.textTertiary;

  return (
    <Pressable
      testID={`tab-${name}`}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: motion.instant }));
      }}
      onPressOut={() => {
        pressed.set(withTiming(0, { duration: motion.fast }));
      }}
      style={[styles.item, style]}
    >
      <Animated.View style={[styles.itemContent, contentStyle]}>
        <Animated.View style={iconStyle}>
          <Icon
            name={icon}
            size={ICON_SIZE}
            color={iconColor}
            strokeWidth={selected ? 2.3 : 1.9}
            optical
            testID={`tab-${name}-icon`}
          />
        </Animated.View>

        <Text
          variant="navLabel"
          tone={selected ? "primary" : "secondary"}
          style={selected ? styles.labelSelected : styles.label}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Centre slot                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Home and Expenses are the outer thirds; this is what sits between them.
 *
 * It has to exist for the two tabs to be centred in their own thirds rather
 * than butted up against the bar's middle. It ignores touches, so a tap in
 * that region falls through to the Add button above it instead of registering
 * as a tab.
 */
export function NavCenterSlot() {
  return (
    <View
      style={styles.centerSlot}
      accessibilityRole="none"
      pointerEvents="none"
      testID="nav-center-slot"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Center Add button                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The centred Add action.
 *
 * Centring is absolute and derived from nothing but the bar's own frame: the
 * overlay takes the exact same `navBarPosition` insets as the glass surface
 * and the touch list, then centres its single child with `alignItems: 'center'`.
 * So the button lands on the bar's true midpoint at any screen width, and stays
 * there however wide the Home and Expenses labels or icons happen to measure —
 * the drift a flex row shared with the tabs would have.
 *
 * `pointerEvents: 'box-none'` lets taps either side reach the tabs underneath
 * while the button's own 48dp circle still receives its touches.
 *
 * The press response is the same one `NavItem` gives the Home and Expenses
 * icons — a quick dip to 0.94 and 0.6 opacity, no rotation — so every control
 * on the bar answers a touch the same way.
 */
export function NavAddButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(pressed.get() ? 0.6 : 1, {
      duration: reduceMotion ? 0 : motion.instant,
    }),
    transform: [
      {
        scale: withTiming(pressed.get() ? 0.94 : 1, {
          duration: reduceMotion ? 0 : motion.instant,
        }),
      },
    ],
  }));

  return (
    <View style={[styles.addOverlay, style]}>
      <Pressable
        testID="nav-add"
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        accessibilityHint="Opens the add expense screen"
        onPress={openAddExpense}
        onPressIn={() => {
          pressed.set(withTiming(1, { duration: motion.instant }));
        }}
        onPressOut={() => {
          pressed.set(withTiming(0, { duration: motion.fast }));
        }}
        hitSlop={6}
      >
        <Animated.View style={[styles.addHalo, animatedStyle]}>
          <GlassSurface
            solid
            blurred={false}
            radius={radii.pill}
            shadow="md"
            style={styles.addCircle}
          >
            <Icon name="plus" size={22} color={colors.textOnAccent} testID="nav-add-icon" />
          </GlassSurface>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function openAddExpense() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Haptics are unavailable on web and some devices. Never block the tap.
  });
  router.push("/add-expense");
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  bar: {
    height: HEIGHT,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 6,

    backgroundColor: "rgba(19, 25, 38, 0.88)",
  },

  indicatorPill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(108, 123, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(108, 123, 255, 0.35)",
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  centerSlot: {
    flex: 1,
  },

  item: {
    flex: 1,
    alignSelf: "center",

    minHeight: touchTarget.navItemMinHeight,

    alignItems: "center",
    justifyContent: "center",
  },

  itemContent: {
    alignItems: "center",
    justifyContent: "center",

    gap: ICON_LABEL_GAP,
  },

  addOverlay: {
    // `navBarPosition` supplies `position: 'absolute'`, `left` and `right`, so
    // this box already covers the bar; these two inputs simply centre the
    // button in it.
    alignItems: "center",
    justifyContent: "center",
    height: HEIGHT,
    // Lets touches pass through to the triggers except on the button itself.
    pointerEvents: "box-none",
  },

  addHalo: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(108, 123, 255, 0.20)",
    borderWidth: 1,
    borderColor: "rgba(108, 123, 255, 0.38)",
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  addCircle: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    minWidth: touchTarget.min - 2,
    minHeight: touchTarget.min - 2,
  },

  label: {
    textAlign: "center",
  },

  labelSelected: {
    textAlign: "center",
    fontWeight: fontWeight.bold,
  },
});

