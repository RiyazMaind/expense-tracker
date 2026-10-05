/**
 * Public design-system API.
 *
 * App code imports from '@/theme' only. Nothing outside this folder should
 * reach into tokens/typography directly — that indirection is what makes a
 * global token change safe
 * (vercel-react-native-skills/rules/imports-design-system-folder.md).
 */

import { AccessibilityInfo } from 'react-native';
import { Easing } from 'react-native-reanimated';

import { easing as easingTuples } from './tokens';

export {
  blur,
  blurAndroidDivisor,
  borders,
  colors,
  glass,
  motion,
  navigation,
  radii,
  shadows,
  spacing,
  touchTarget,
  zIndex,
  type BorderLevel,
  type EasingTuple,
  type GlassLevel,
} from './tokens';

export {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  textVariants,
  type TextVariant,
} from './typography';

/**
 * Reanimated-ready easing functions, built from the token tuples.
 *
 * Reanimated requires `Easing.bezier(...)` rather than a raw 4-tuple, so the
 * curves are declared once in tokens and converted here. Screens and
 * components never import `Easing` directly for this.
 */
export const easing = {
  standard: Easing.bezier(...easingTuples.standard),
  decelerate: Easing.bezier(...easingTuples.decelerate),
};

/**
 * Whether the user has asked for reduced motion.
 *
 * glassmorphism-design requires respecting reduced-motion preferences, and
 * ui-ux-pro-max rates ignoring them as High severity. React Native exposes
 * this as a single boolean on iOS and Android.
 *
 * Returns false until the first async read resolves, so animations are enabled
 * by default rather than flashing off for users who have not set the
 * preference.
 */
export async function isReduceMotionEnabled(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    return false;
  }
}

/**
 * Subscribe to reduce-motion changes.
 *
 * Returns an unsubscribe function. If the platform does not emit the event the
 * subscription simply never fires and the initial value stands.
 */
export function subscribeReduceMotion(
  listener: (enabled: boolean) => void
): () => void {
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    listener
  );
  return () => subscription.remove();
}