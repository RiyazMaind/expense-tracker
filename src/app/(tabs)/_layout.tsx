import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassNavBar,
  NavItem,
  navBarHeight,
  navBarPosition,
  tabs,
} from '@/components/navigation/glass-nav-bar';
import { colors, navigation, radii } from '@/theme';

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
        {tabs.map((tab) => (
          <TabTrigger
            key={tab.name}
            name={tab.name}
            href={tab.href}
            asChild
            style={styles.trigger}
          >
            <NavItem name={tab.name} label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
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
});