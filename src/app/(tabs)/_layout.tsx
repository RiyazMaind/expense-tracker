import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassNavBar,
  NavAddButton,
  NavCenterSlot,
  NavItem,
  expensesTab,
  homeTab,
  navBarPosition,
  navListStyle,
} from '@/components/navigation/glass-nav-bar';
import { colors, navigation } from '@/theme';

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
 *
 * The surface (`GlassNavBar`), the centre slot, the Add button and the touch
 * row's layout (`navListStyle`) are all shared with the standalone bar on
 * Settings — one bar, two hosts.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const activeIndex = pathname.startsWith('/expenses') ? 1 : 0;

  // Floats above the home indicator / gesture bar.
  const position = [navBarPosition, { bottom: navigation.bottomOffset + insets.bottom }];

  return (
    <Tabs style={styles.root}>
      <TabSlot />

      <GlassNavBar style={position} activeIndex={activeIndex} />

      <TabList style={[navListStyle, position]}>
        <TabTrigger name={homeTab.name} href={homeTab.href} asChild style={styles.trigger}>
          <NavItem
            name={homeTab.name}
            label={homeTab.label}
            icon={homeTab.icon}
            isFocused={activeIndex === 0}
          />
        </TabTrigger>

        <NavCenterSlot />

        <TabTrigger name={expensesTab.name} href={expensesTab.href} asChild style={styles.trigger}>
          <NavItem
            name={expensesTab.name}
            label={expensesTab.label}
            icon={expensesTab.icon}
            isFocused={activeIndex === 1}
          />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  trigger: {
    flex: 1,
  },
});
