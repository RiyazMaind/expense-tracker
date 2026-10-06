import { router } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import {
  GlassNavBar,
  NavItem,
  expensesTab,
  homeTab,
  navBarHeight,
  navBarPosition,
} from '@/components/navigation/glass-nav-bar';
import { Icon } from '@/components/ui/icon';
import { colors, navigation, radii, touchTarget } from '@/theme';

/**
 * Tab group layout.
 *
 * Uses the headless `expo-router/ui` tabs so the bar can be the project's own
 * floating glass surface (product decision 4).
 *
 * `TabList` and its `TabTrigger`s are rendered as direct children of `Tabs` on
 * purpose: Expo Router discovers routes by walking `Tabs`' direct children and
 * only recurses into fragments and `TabList`, so wrapping the list in another
 * component leaves the navigator with no screens. The glass bar is layered
 * underneath the transparent list instead, which both satisfies that contract
 * and keeps the material in one place.
 *
 * The three slots are laid out left-to-right as Home, an inert middle third, and
 * Expenses, so each tab is centred in its own outer third and the bar's midpoint
 * is left empty for the Add action.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Floats above the home indicator / gesture bar.
  const position = [navBarPosition, { bottom: navigation.bottomOffset + insets.bottom }];

  return (
    <Tabs style={styles.root}>
      <TabSlot />

      <GlassNavBar style={position} />

      <TabList style={[styles.list, position]}>
        <TabTrigger name={homeTab.name} href={homeTab.href} asChild style={styles.trigger}>
          <NavItem name={homeTab.name} label={homeTab.label} icon={homeTab.icon} />
        </TabTrigger>

        <TabCenterSlot />

        <TabTrigger name={expensesTab.name} href={expensesTab.href} asChild style={styles.trigger}>
          <NavItem name={expensesTab.name} label={expensesTab.label} icon={expensesTab.icon} />
        </TabTrigger>
      </TabList>

      {/*
        Add is not a tab — it pushes `/add-expense` rather than switching
        screens — so it is layered over the list on its own absolutely centred
        overlay rather than sharing the tabs' flex row.
      */}
      <NavAddButton style={position} />
    </Tabs>
  );
}

/**
 * Home and Expenses are the outer thirds; this is what sits between them.
 *
 * It has to exist for the two tabs to be centred in their own thirds rather than
 * butted up against the bar's middle. It ignores touches, so a tap in that region
 * falls through to the Add button above it instead of registering as a tab.
 */
function TabCenterSlot() {
  return (
    <View
      style={styles.centerSlot}
      accessibilityRole="none"
      pointerEvents="none"
      testID="nav-center-slot"
    />
  );
}

/**
 * The centred Add action.
 *
 * Centring is absolute and derived from nothing but the bar's own frame: the
 * overlay takes the exact same `navBarPosition` insets as the glass surface and
 * the touch list, then centres its single child with `alignItems: 'center'`. So
 * the button lands on the bar's true midpoint at any screen width, and stays
 * there however wide the Home and Expenses labels or icons happen to measure —
 * the drift a flex row shared with the tabs would have.
 *
 * `pointerEvents: 'box-none'` lets taps either side reach the tabs underneath
 * while the button's own 48dp circle still receives its touches.
 */
function NavAddButton({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.addOverlay, style]}>
      <Pressable
        testID="nav-add"
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        accessibilityHint="Opens the add expense screen"
        onPress={openAddExpense}
        hitSlop={6}
      >
        <GlassSurface
          solid
          blurred={false}
          radius={radii.pill}
          shadow="md"
          style={styles.addCircle}
        >
          <Icon name="plus" size={22} color={colors.textOnAccent} testID="nav-add-icon" />
        </GlassSurface>
      </Pressable>
    </View>
  );
}

function openAddExpense() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // Haptics are unavailable on web and some devices. Never block the tap.
  });
  router.push('/add-expense');
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flexDirection: 'row',
    alignItems: 'center',
    // Matches the glass surface exactly, so the touch layer and the material
    // stay aligned whichever bar height the navbar is tuned to.
    height: navBarHeight,
    // No horizontal padding: `navBarPosition` already insets both the surface
    // and this list by the same 14pt. Padding here as well would double the
    // inset on the touches while leaving the glass where it is, so the touch
    // targets would sit 4pt inside the visible bar.
    paddingHorizontal: 0,
    // Transparent: the glass surface below provides the material, so this list
    // only exists to lay out items and receive touches.
    backgroundColor: 'transparent',
    borderRadius: radii.pill,
  },
  trigger: {
    flex: 1,
  },
  centerSlot: {
    flex: 1,
  },
  addOverlay: {
    // `position` supplies `position: 'absolute'`, `left` and `right`, so this
    // box already covers the bar; these two inputs simply centre the button in it.
    alignItems: 'center',
    justifyContent: 'center',
    height: navBarHeight,
    // Lets touches pass through to the triggers except on the button itself.
    pointerEvents: 'box-none',
  },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    minWidth: touchTarget.min,
    minHeight: touchTarget.navItemMinHeight,
  },
});
