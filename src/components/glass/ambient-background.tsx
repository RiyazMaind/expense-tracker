import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/**
 * The atmospheric layer every screen sits on.
 *
 * docs/design-system.md calls for a deep neutral background with "restrained
 * blurred gradient lights" and no decorative noise competing with financial
 * data. glassmorphism-design adds: a small number of large light sources
 * rather than many decorative blobs, and the background must never reduce
 * readability of amounts or labels.
 *
 * These are static gradients, not looping animations, so nothing repaints
 * continuously behind scrolling content.
 */
export function AmbientBackground() {
  return (
    <View style={styles.root} testID="ambient-background">
      <LightSource style={styles.topLeft} colors={['rgba(108,123,255,0.20)', 'rgba(108,123,255,0.05)', 'transparent']} />
      <LightSource style={styles.bottomRight} colors={['rgba(56,189,248,0.13)', 'rgba(56,189,248,0.04)', 'transparent']} />
      <LightSource style={styles.topRight} colors={['rgba(167,139,250,0.09)', 'rgba(167,139,250,0.03)', 'transparent']} />
    </View>
  );
}

/** A single large, soft light source that fades out completely at its edge. */
function LightSource({
  style,
  colors: stops,
}: {
  style: object;
  colors: readonly [string, string, string];
}) {
  return (
    <View style={[styles.source, style]}>
      <LinearGradient
        colors={stops}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    // Decorative only: must never intercept touches aimed at the UI above.
    pointerEvents: 'none',
  },
  source: {
    position: 'absolute',
    borderRadius: 999,
  },
  topLeft: {
    top: -200,
    left: -160,
    width: 480,
    height: 480,
  },
  bottomRight: {
    bottom: -240,
    right: -180,
    width: 540,
    height: 540,
  },
  topRight: {
    top: 80,
    right: -220,
    width: 400,
    height: 400,
  },
});