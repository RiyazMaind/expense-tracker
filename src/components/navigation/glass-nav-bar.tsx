import type { Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { blur, colors, fontWeight, motion, radii, touchTarget } from '@/theme';

/** Tab definitions. `name` matches the route file name; `href` the route. */
export type TabDefinition = {
  name: string;
  href: Href;
  label: string;
  icon: IconName;
};

export const tabs: readonly TabDefinition[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home' },
  { name: 'expenses', href: '/expenses', label: 'Expenses', icon: 'receipt' },
  { name: 'analytics', href: '/analytics', label: 'Analytics', icon: 'chart' },
  { name: 'budget', href: '/budget', label: 'Budget', icon: 'wallet' },
  { name: 'settings', href: '/settings', label: 'Settings', icon: 'sliders' },
];

/**
 * The visual half of the floating glass bottom navigation: a blurred glass pill
 * that floats above the safe area.
 *
 * The bar itself is the only surface in it. Tabs are flat — icon over label,
 * nothing drawn between them or behind them — so the glass is the only material
 * in the component and the selected tab is distinguished by brightness alone.
 *
 * This is deliberately separate from the interactive list. Expo Router's
 * headless `Tabs` discovers routes by walking its direct children and only
 * recurses into fragments and `TabList`, so the `TabList` and its `TabTrigger`s
 * must be rendered as direct children of `Tabs` (see `(tabs)/_layout.tsx`).
 * The bar is therefore layered: this glass surface provides the material, and
 * a transparent `TabList` sits on top of it to receive touches.
 *
 * Built on `expo-router/ui` rather than `NativeTabs` because the design system
 * calls for a bar that floats above the safe area on its own glass surface; a
 * native tab bar cannot be styled that way (product decision 4).
 */
export function GlassNavBar({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <GlassSurface
      level="subtle"
      borderLevel="subtle"
      radius={radii.pill}
      intensity={blur.navigation}
      shadow="md"
      style={[styles.bar, style]}
      testID="glass-nav-bar"
    />
  );
}

/**
 * Bar metrics.
 *
 * Deliberately local to this component rather than added to `navigation` in the
 * theme, because these describe this one bar's internal rhythm: they are tuned
 * against five tabs on a 360dp screen, and nothing else in the app needs them.
 *
 * - `HEIGHT` is 54, down from 56. The content block is 37 (20 icon + 3 gap +
 *   13 label), so a 54pt bar still leaves 8.5pt of glass above and below the
 *   content rather than the content filling it edge to edge.
 * - `HORIZONTAL_MARGIN` of 14 gives the bar a deliberate float off the screen
 *   edges while still leaving 66.4pt per tab.
 * - `ICON_LABEL_GAP` of 3 is what "tight but not cramped" looks like: at 5 the
 *   measured gap between the icon's ink and the label's glyph was 9pt, which
 *   read as two separate elements rather than one tab.
 */
const HEIGHT = 54;
const HORIZONTAL_MARGIN = 14;
const ICON_SIZE = 20;
const ICON_LABEL_GAP = 3;

/** Positioning for both the glass surface and the transparent `TabList`. */
export const navBarPosition: ViewStyle = {
  position: 'absolute',
  left: HORIZONTAL_MARGIN,
  right: HORIZONTAL_MARGIN,
};

/** Bar height, shared with the transparent `TabList` laid over the surface. */
export const navBarHeight = HEIGHT;

/**
 * Visual tab: icon, label and the active state.
 *
 * `TabTrigger asChild` renders this as the trigger element but does not forward
 * selected state, so it reads its own state through `useTabTrigger`.
 *
 * Because `TabTrigger` renders via a Radix slot, this component's `onPress` is
 * composed with the trigger's own handler, so navigation still happens while
 * the haptic fires here.
 */
export type NavItemProps = {
  name: string;
  label: string;
  icon: IconName;
  /**
   * Injected by `TabTrigger asChild`: the tab's selected state.
   * `TabTrigger` passes `isFocused` to its child element, which is the most
   * direct source of truth available here.
   */
  isFocused?: boolean;
  /** Injected by `TabTrigger asChild`: performs the navigation. */
  onPress?: (event: unknown) => void;
  /** Injected by `TabTrigger asChild`. */
  onLongPress?: (event: unknown) => void;
  /** Injected by `TabTrigger asChild`; not a valid Pressable prop. */
  href?: unknown;
  style?: StyleProp<ViewStyle>;
};

/**
 * Visual tab: icon, label and an animated active pill.
 *
 * `TabTrigger asChild` clones this element and injects `isFocused`, `onPress`
 * and `onLongPress` through a Radix slot. Those props MUST be accepted and
 * forwarded to the `Pressable` — if they are swallowed, the trigger has no
 * press handler and tab navigation silently stops working.
 *
 * `href`, `isFocused` and `name` are deliberately not spread onto the
 * `Pressable`, since they are not valid React Native props.
 */
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

  /**
   * Press feedback, and the only animation left in the bar.
   *
   * There is no active indicator to scale any more, so this drives a plain
   * opacity dip on the icon and label. It is feedback, not decoration — it
   * acknowledges the touch without adding a shape behind it.
   */
  const pressed = useSharedValue(0);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(pressed.get() ? 0.55 : 1, {
      duration: reduceMotion ? 0 : motion.instant,
    }),
  }));

  const handlePress = (event: Parameters<NonNullable<NavItemProps['onPress']>>[0]) => {
    // Only confirm an actual tab change, not a re-tap of the current tab.
    if (!selected) {
      Haptics.selectionAsync().catch(() => {
        // Haptics are unavailable on web and some devices. Never block the tap.
      });
    }
    // Hand off to the trigger, which performs the actual navigation.
    onPress?.(event);
  };

  /**
   * Active state is carried by brightness and weight alone.
   *
   * Monochrome by intent: the bar is a single glass surface, so a filled pill
   * behind one tab read as a bubble sitting on top of it. Instead the selected
   * tab goes near-white (`colors.text`, ~17:1 against the bar fill) and the
   * four others sit back in neutral greys.
   *
   * Icon and label use different idle greys, because they are different kinds of
   * thing and are held to different contrast floors. The icon is a graphic and
   * only needs 3:1, so it can take the quieter `textTertiary` (measured 3.9:1).
   * The label is text and needs 4.5:1, which `textTertiary` fails, so it uses
   * `textSecondary` (measured 8.2:1). Both still read clearly muted against the
   * active tab.
   */
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
      // `style` carries the trigger's flex sizing from TabTrigger.
      style={[styles.item, style]}
    >
      {/*
        No indicator element. Anything drawn behind the icon or label here
        would be exactly the filled background this bar must not have, so the
        content is the only thing that renders.
      */}
      <Animated.View style={[styles.itemContent, contentStyle]}>
        {/*
         * `optical` is what makes the five glyphs read as one family. They are
         * hand-drawn, so their ink boxes genuinely differ — the house fills
         * 19.1 x 18.1 of the 24-unit grid while the bar chart only reaches
         * 16.7 x 12.6. Measured in the nav at a shared box, the chart and the
         * sliders rendered about a third smaller than the house. Compensation
         * is scoped to this bar so no other icon on the app changes.
         *
         * The selected tab also gets a slightly heavier stroke. A 0.4pt step at
         * 20pt reads as emphasis rather than as a different icon, and it is the
         * only weight cue available for the graphic now that the pill is gone.
         */}
        <Icon
          name={icon}
          size={ICON_SIZE}
          color={iconColor}
          strokeWidth={selected ? 2.3 : 1.9}
          optical
          testID={`tab-${name}-icon`}
        />
        {/*
         * The label supports the icon rather than competing with it: 10pt
         * against a 20pt box, refined tracking. Its leading is owned by the
         * `navLabel` variant rather than a local override, so it cannot inherit
         * the 15pt body line-height that used to push the glyph away from the
         * icon. Only the selected tab is bolded.
         */}
        <Text
          variant="navLabel"
          tone={selected ? 'primary' : 'secondary'}
          style={selected ? styles.labelSelected : styles.label}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: HEIGHT,
  },
  item: {
    flex: 1,
    // `center` rather than `stretch`: the bar is only 54 tall, so letting the
    // touch layer stretch would make the row's vertical rhythm depend on the
    // tallest label instead of on the bar.
    alignSelf: 'center',
    // 48pt, comfortably over the 44pt minimum, and unchanged from before — the
    // pill's padding was never what made the target large.
    minHeight: touchTarget.navItemMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: ICON_LABEL_GAP,
  },
  /**
   * The label is a supporting role, so its type lives in the `navLabel` variant.
   * This style only centres the text within the icon's width — a label narrower
   * than its icon would otherwise sit off-centre.
   */
  label: {
    textAlign: 'center',
  },
  /**
   * The whole of the selected state at type level: one weight step up.
   *
   * Only regular and bold render distinctly on Android — 400/500/600 are
   * identical output from the bundled variable font, which Android synthesises
   * rather than resolves — so `bold` is the only real step available, and it is
   * the one that reads as emphasis at 10pt.
   */
  labelSelected: {
    textAlign: 'center',
    fontWeight: fontWeight.bold,
  },
});