/**
 * Design tokens for the Expense Tracker.
 *
 * Source of truth: docs/design-system.md (dark premium glassmorphism).
 * Values here are the "conceptual starting values" the docs describe; the
 * rendered result is the final authority (docs/design-system.md, Design Rule).
 *
 * This app is dark-only by product decision. There is intentionally no light
 * palette.
 *
 * Import from '@/theme' rather than this file directly, so tokens can be
 * refactored without touching call sites
 * (vercel-react-native-skills/rules/imports-design-system-folder.md).
 */

/** Base canvas. Deep neutral, not pure black, so ambient light has somewhere to live. */
export const colors = {
  /** App background. */
  background: '#080B12',
  /** Slightly lifted background for wells and inset areas. */
  backgroundElevated: '#0D111A',
  /** Fallback fill for surfaces when blur is unavailable. */
  surfaceFallback: '#131926',

  /** Primary text. */
  text: '#F5F7FA',
  /** Secondary text: labels, supporting copy. */
  textSecondary: '#A6AEBD',
  /** Tertiary text: timestamps, captions. */
  textTertiary: '#6C7688',
  /** Text on top of a solid accent fill. */
  textOnAccent: '#FFFFFF',

  /** Primary accent. Restrained violet-blue. */
  accent: '#6C7BFF',
  /** Accent for pressed/active states. */
  accentPressed: '#5968E8',
  /** Low-alpha accent for selected-state fills. */
  accentMuted: 'rgba(108, 123, 255, 0.16)',
  /** Secondary accent for data highlights. */
  accentSecondary: '#38BDF8',

  /** Semantic: within budget, positive deltas. */
  positive: '#34D399',
  /** Semantic: approaching limit. */
  warning: '#FBBF24',
  /** Semantic: overspent, destructive actions. */
  destructive: '#F87171',

  /** Scrim behind modals. */
  scrim: 'rgba(4, 6, 11, 0.72)',
} as const;

/**
 * Glass surface fills.
 *
 * Per glassmorphism-design: low-opacity white, very subtle borders, moderate
 * blur. Not every element is glass — see GlassSurface usage rules.
 */
export const glass = {
  subtle: 'rgba(255, 255, 255, 0.04)',
  default: 'rgba(255, 255, 255, 0.06)',
  strong: 'rgba(255, 255, 255, 0.09)',
} as const;

export type GlassLevel = keyof typeof glass;

/** Hairline borders. 1px, never a solid grey border. */
export const borders = {
  subtle: 'rgba(255, 255, 255, 0.08)',
  default: 'rgba(255, 255, 255, 0.10)',
  strong: 'rgba(255, 255, 255, 0.15)',
} as const;

export type BorderLevel = keyof typeof borders;

/**
 * Blur intensity per glass level (1-100).
 *
 * Kept moderate on purpose: glassmorphism-design warns against blurring
 * everything, and high-end-visual-design notes backdrop blur on large or
 * scrolling areas causes continuous GPU repaints on mobile.
 */
export const blur = {
  subtle: 20,
  default: 32,
  strong: 48,
  /** Bottom navigation sits above scrolling content, so it blurs the most. */
  navigation: 56,
} as const satisfies Record<GlassLevel | 'navigation', number>;

/** Android blur tuning so perceived intensity matches iOS. */
export const blurAndroidDivisor = 4;

/** Spacing scale in points. Use `gap` on containers rather than child margins. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/**
 * Corner radii.
 *
 * `borderCurve: 'continuous'` is paired with these at every usage site for
 * iOS-style continuous corners
 * (vercel-react-native-skills/rules/ui-styling.md).
 */
export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * Elevation.
 *
 * Uses the CSS `boxShadow` string syntax available in RN 0.86 rather than the
 * legacy shadow props, for cross-platform consistency
 * (vercel-react-native-skills/rules/ui-styling.md).
 *
 * Shadows stay restrained: the design direction is calm, not floaty.
 */
export const shadows = {
  none: 'none',
  sm: '0 2px 8px rgba(0, 0, 0, 0.28)',
  md: '0 8px 24px rgba(0, 0, 0, 0.34)',
  lg: '0 16px 40px rgba(0, 0, 0, 0.42)',
} as const;

/**
 * Motion.
 *
 * Subtle and purposeful only. glassmorphism-design forbids constant looping or
 * decorative animation. Durations sit in the 150-300ms band recommended by
 * ui-ux-pro-max for micro-interactions.
 */
export const motion = {
  /** Press feedback. */
  instant: 90,
  /** Small state change: selection, chip toggle. */
  fast: 160,
  /** Default: card entrance, tab indicator. */
  normal: 220,
  /** Larger transitions: modal presentation. */
  slow: 300,
} as const;

/**
 * Shared easing curves as `[x1, y1, x2, y2]` cubic Bézier tuples.
 *
 * Reanimated expects a mutable 4-tuple, so these are typed explicitly rather
 * than left `as const`. Avoids `linear` and bare `ease-in-out`, which read as
 * mechanical.
 */
export type EasingTuple = [number, number, number, number];

export const easing: { standard: EasingTuple; decelerate: EasingTuple } = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0.05, 0.7, 0.1, 1],
};

/**
 * Minimum interactive size.
 *
 * 44x44 is the accessibility floor (ui-ux-pro-max, touch-target-size) and the
 * lower bound Android and iOS guidelines expect.
 */
export const touchTarget = {
  min: 44,
  /** Nav items get extra room for mis-taps (e2e-testing: no accidental taps). */
  navItemMinHeight: 48,
} as const;

/** Layer order. Referenced instead of scattering magic numbers. */
export const zIndex = {
  background: 0,
  content: 10,
  nav: 30,
  overlay: 40,
  modal: 50,
} as const;

/** Height of the floating nav bar, excluding the bottom safe-area inset. */
export const navigation = {
  /** Compact bar: icon + label with breathing room, not a slab. */
  height: 56,
  /** Distance the bar floats above the bottom safe-area edge. */
  bottomOffset: 10,
  /** Keeps the last scrollable item clear of the floating bar. */
  contentBottomClearance: 88,
  /** Side inset of the bar. Narrow, so five labels fit on a 360dp screen. */
  horizontalMargin: spacing.sm,
} as const;