import { BlurTargetView, BlurView } from 'expo-blur';
import type { PropsWithChildren, ReactNode } from 'react';
import { createContext, useContext, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  blur,
  borders,
  colors,
  glass,
  radii,
  shadows,
  type BorderLevel,
  type GlassLevel,
} from '@/theme';

/**
 * A ref to the view whose contents a BlurView should sample.
 *
 * expo-blur requires this on Android since SDK 55: without a blur target the
 * view renders as a plain translucent rectangle. One target can serve many
 * BlurViews, which is more efficient than a target per surface — so the app
 * shell publishes a single target and surfaces read it from context.
 */
const BlurTargetContext = createContext<React.RefObject<View | null> | null>(null);

/** Provides the shared blur target. Render once, high in the tree. */
export function GlassBlurProvider({ children }: PropsWithChildren) {
  const targetRef = useRef<View>(null);

  return (
    <BlurTargetContext.Provider value={targetRef}>
      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill}>
        {children}
      </BlurTargetView>
    </BlurTargetContext.Provider>
  );
}

export type GlassSurfaceProps = PropsWithChildren<{
  /** Glass fill level. */
  level?: GlassLevel;
  /** Border level. Defaults to matching the glass level. */
  borderLevel?: BorderLevel;
  /** Corner radius from tokens. */
  radius?: number;
  /**
   * Explicit blur intensity. Overrides the level default.
   * The bottom navigation passes a higher value because it floats over
   * scrolling content.
   */
  intensity?: number;
  /** Elevation from tokens. */
  shadow?: keyof typeof shadows;
  /**
   * Solid, higher-contrast surface. Use for controls that must stay legible
   * regardless of what sits behind them — per glassmorphism-design, primary
   * CTAs and destructive actions should not be plain glass.
   */
  solid?: boolean;
  /** Set false to drop the blur entirely (already-solid surfaces). */
  blurred?: boolean;
  /** Optional inner highlight along the top edge, for extra depth. */
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Forwarded for e2e selectors (e2e-testing: prefer stable testIDs). */
  testID?: string;
  /** Forwarded so grouped surfaces can be announced as one unit. */
  accessibilityLabel?: string;
  accessibilityRole?: 'summary' | 'image' | 'none';
  /** Extra content rendered above the blur (icons, children overlays). */
  overlay?: ReactNode;
}>;

/**
 * The only component in the app that renders blur.
 *
 * Everything translucent goes through here so blur intensity, borders and the
 * Android fallback stay consistent and cannot drift per-screen.
 *
 * Behaviour that matters:
 * - Android samples the shared `BlurTargetView`; iOS blurs natively.
 * - When blur is unavailable (web, low-end devices, `blurred={false}`) the
 *   surface falls back to an opaque-enough fill so text stays readable.
 *   glassmorphism-design requires the UI to look good without blur.
 */
export function GlassSurface({
  children,
  level = 'default',
  borderLevel,
  radius = radii.lg,
  intensity,
  shadow = 'md',
  solid = false,
  blurred = true,
  highlighted = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityRole,
  overlay,
}: GlassSurfaceProps) {
  const blurTarget = useContext(BlurTargetContext);

  // On Android a BlurView without a target degrades to a flat translucent
  // view, so skip it entirely and use the fallback fill instead.
  const canBlur = blurred && !solid;
  /**
   * Native blur is iOS-only on purpose.
   *
   * `expo-blur`'s Android `BlurView` (`blurMethod="dimezisBlurView"`) crashes
   * the app process natively — no Java stack trace, just `finishTopCrash` —
   * when glass surfaces mount and unmount during a tab switch. Verified on
   * Android 17 by toggling native blur off, which made tab navigation work.
   *
   * Android therefore uses the translucent fallback fill below. That is not a
   * downgrade: glassmorphism-design's quality gate requires the UI to look good
   * without blur, Android backdrop blur is expensive, and Android is the
   * primary target, so it must not crash.
   *
   * The Android blur path is kept intact behind `blurTarget` so it can be
   * re-enabled once the upstream crash is resolved.
   */
  const useNativeBlur = canBlur && Platform.OS === 'ios';

  const backgroundColor = solid ? colors.surfaceFallback : glass[level];

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        styles.container,
        {
          borderRadius: radius,
          borderCurve: 'continuous',
          backgroundColor,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: borders[borderLevel ?? level],
          boxShadow: shadows[shadow],
        },
        style,
      ]}
    >
      {useNativeBlur ? (
        <BlurView
          intensity={intensity ?? blur[level]}
          tint="dark"
          blurMethod="dimezisBlurView"
          {...(blurTarget != null ? { blurTarget } : {})}
          style={[
            StyleSheet.absoluteFill,
            // `style.pointerEvents` is the supported API; the `pointerEvents`
            // prop is deprecated in RN 0.86.
            { pointerEvents: 'none' },
            { borderRadius: radius, borderCurve: 'continuous' },
          ]}
        />
      ) : null}

      {highlighted ? (
        <View
          style={[
            styles.highlight,
            { pointerEvents: 'none' },
            {
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              borderCurve: 'continuous',
            },
          ]}
        />
      ) : null}

      <View style={styles.content}>{children}</View>

      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    // Padding lives on the caller's inner view; this keeps the blur behind
    // the content and the border above it.
    flexShrink: 1,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: borders.strong,
    opacity: 0.7,
  },
});