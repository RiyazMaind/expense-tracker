import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Icon } from '@/components/ui/icon';
import { colors, radii } from '@/theme';

export type SettingsIconButtonProps = {
  testID?: string;
};

/**
 * The Settings destination, as a compact icon button.
 *
 * Settings is no longer a tab, so every primary screen carries this affordance
 * in the top-right of its header. Sliders rather than a gear: it matches the
 * design system's existing settings glyph and reads as "adjustments" rather
 * than "system".
 */
export function SettingsIconButton({ testID = 'settings-button' }: SettingsIconButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      accessibilityHint="Opens the settings screen"
      onPress={() => router.push('/settings')}
      hitSlop={8}
    >
      <GlassSurface
        level="default"
        borderLevel="subtle"
        radius={radii.pill}
        shadow="sm"
        highlighted
        style={styles.button}
      >
        <Icon name="sliders" size={18} color={colors.text} testID={`${testID}-icon`} />
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
