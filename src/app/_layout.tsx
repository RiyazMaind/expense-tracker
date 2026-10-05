import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/glass/ambient-background';
import { GlassBlurProvider } from '@/components/glass/glass-surface';
import { colors, glass } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or unsupported on this platform. Never block startup.
});

/**
 * Expo Router theme, pinned to the dark palette so native headers and
 * background transitions never flash a light surface in a dark-only app.
 */
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.backgroundElevated,
    text: colors.text,
    border: glass.subtle,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Ignore: the splash is already dismissed.
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          {/*
            GlassBlurProvider wraps the navigator: Android's BlurView samples
            this view, so it must sit above every screen that renders a glass
            surface.
          */}
          <GlassBlurProvider>
            <AmbientBackground />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            />
          </GlassBlurProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});