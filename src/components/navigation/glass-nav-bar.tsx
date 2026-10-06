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

const ADD_BUTTON_SIZE = 54;

/**
 * Shared absolute positioning for the floating navbar.
 */
export const navBarPosition: ViewStyle = {
  position: "absolute",
  left: HORIZONTAL_MARGIN,
  right: HORIZONTAL_MARGIN,
};

export const navBarHeight = HEIGHT;

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

export function GlassNavBar({
  style,
  activeIndex = 0,
}: {
  style?: StyleProp<ViewStyle>;
  activeIndex?: number;
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
      <ActiveTabIndicator activeIndex={activeIndex} />
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
/* Center Add button                                                          */
/* -------------------------------------------------------------------------- */

export function AddNavButton() {
  const reduceMotion = useReducedMotion();

  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withTiming(pressed.get() ? 0.92 : 1, {
          duration: reduceMotion ? 0 : motion.instant,
        }),
      },
    ],
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withSpring(pressed.get() ? "45deg" : "0deg", {
          damping: 15,
          stiffness: 200,
        }),
      },
    ],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/add-expense");
  };

  return (
    <Pressable
      testID="nav-add-expense"
      accessibilityRole="button"
      accessibilityLabel="Add expense"
      accessibilityHint="Opens the add expense screen"
      onPress={handlePress}
      onPressIn={() => {
        pressed.set(withTiming(1, { duration: motion.instant }));
      }}
      onPressOut={() => {
        pressed.set(withTiming(0, { duration: motion.fast }));
      }}
      style={styles.addButtonTouchTarget}
    >
      <Animated.View style={[styles.addHalo, animatedStyle]}>
        <View style={styles.addButtonCore}>
          <Animated.View style={iconAnimatedStyle}>
            <Icon
              name="plus"
              size={24}
              color={colors.textOnAccent}
              strokeWidth={2.4}
              optical
            />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Complete 3-slot visual navigation                                          */
/* -------------------------------------------------------------------------- */

/**
 * Visual structure:
 *
 * Home        + Add        Expenses
 *
 * The Add button is absolutely centered so its position does not depend on
 * text width or icon width.
 */
export function ThreeSlotGlassNav({
  style,
  homeFocused = false,
  expensesFocused = false,
  onHomePress,
  onExpensesPress,
}: {
  style?: StyleProp<ViewStyle>;
  homeFocused?: boolean;
  expensesFocused?: boolean;
  onHomePress?: () => void;
  onExpensesPress?: () => void;
}) {
  const activeIndex = homeFocused ? 0 : 1;

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
      <ActiveTabIndicator activeIndex={activeIndex} />

      <Pressable
        testID="nav-home"
        accessibilityRole="tab"
        accessibilityLabel="Home"
        accessibilityState={{ selected: homeFocused }}
        onPress={() => {
          if (!homeFocused) {
            Haptics.selectionAsync().catch(() => {});
          }

          onHomePress?.();
        }}
        style={styles.sideSlot}
      >
        <NavVisual label="Home" icon="home" selected={homeFocused} />
      </Pressable>

      <ViewCenter>
        <AddNavButton />
      </ViewCenter>

      <Pressable
        testID="nav-expenses"
        accessibilityRole="tab"
        accessibilityLabel="Expenses"
        accessibilityState={{ selected: expensesFocused }}
        onPress={() => {
          if (!expensesFocused) {
            Haptics.selectionAsync().catch(() => {});
          }

          onExpensesPress?.();
        }}
        style={styles.sideSlot}
      >
        <NavVisual label="Expenses" icon="receipt" selected={expensesFocused} />
      </Pressable>
    </GlassSurface>
  );
}

/* -------------------------------------------------------------------------- */
/* Visual nav item                                                            */
/* -------------------------------------------------------------------------- */

function NavVisual({
  label,
  icon,
  selected,
}: {
  label: string;
  icon: IconName;
  selected: boolean;
}) {
  return (
    <ViewCenter>
      <Animated.View style={styles.itemContent}>
        <Icon
          name={icon}
          size={ICON_SIZE}
          color={selected ? colors.text : colors.textTertiary}
          strokeWidth={selected ? 2.3 : 1.9}
          optical
        />

        <Text
          variant="navLabel"
          tone={selected ? "primary" : "secondary"}
          style={selected ? styles.labelSelected : styles.label}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </ViewCenter>
  );
}

/* -------------------------------------------------------------------------- */
/* Small layout helper                                                        */
/* -------------------------------------------------------------------------- */

function ViewCenter({ children }: { children: React.ReactNode }) {
  return <Animated.View style={styles.center}>{children}</Animated.View>;
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

  sideSlot: {
    flex: 1,
    height: HEIGHT,

    alignItems: "center",
    justifyContent: "center",

    minHeight: touchTarget.navItemMinHeight,
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

  center: {
    width: ADD_BUTTON_SIZE + 16,
    height: HEIGHT,

    alignItems: "center",
    justifyContent: "center",
  },

  addButtonTouchTarget: {
    width: ADD_BUTTON_SIZE + 12,
    height: HEIGHT,

    alignItems: "center",
    justifyContent: "center",
  },

  addHalo: {
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,

    borderRadius: ADD_BUTTON_SIZE / 2,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(108, 123, 255, 0.20)",
    borderWidth: 1,
    borderColor: "rgba(108, 123, 255, 0.38)",

    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 8,
  },

  addButtonCore: {
    width: ADD_BUTTON_SIZE - 10,
    height: ADD_BUTTON_SIZE - 10,

    borderRadius: (ADD_BUTTON_SIZE - 10) / 2,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: colors.accent,
  },

  label: {
    textAlign: "center",
  },

  labelSelected: {
    textAlign: "center",
    fontWeight: fontWeight.bold,
  },
});

