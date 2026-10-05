import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, navigation } from '@/theme';

export type ScreenProps = PropsWithChildren<{
  /** Wrap content in a ScrollView. Off for screens that own a virtualized list. */
  scroll?: boolean;
  /** Extra bottom padding, on top of the floating-nav clearance. */
  bottomPadding?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/**
 * Standard screen frame.
 *
 * Reserves space below the content for the floating navigation bar so nothing
 * is ever trapped underneath it — mobile-ui-review lists "bottom navigation
 * clearance" as a recurring source of clipped, unreachable content.
 *
 * The top inset is applied here rather than via a SafeAreaView wrapper so it
 * participates in the scroll (content scrolls under the status bar) instead of
 * being a fixed inset
 * (vercel-react-native-skills/rules/ui-safe-area-scroll.md).
 */
export function Screen({
  children,
  scroll = true,
  bottomPadding = 0,
  style,
  contentContainerStyle,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const contentStyle = [
    styles.content,
    { paddingTop: insets.top + spacing.lg },
    { paddingBottom: navigation.contentBottomClearance + bottomPadding },
    contentContainerStyle,
  ];

  if (!scroll) {
    return (
      <View style={[styles.root, style]} testID={testID}>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, style]}
      contentContainerStyle={contentStyle}
      // Lets iOS apply insets natively while we still control our own padding.
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
});