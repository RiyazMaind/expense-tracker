/**
 * Typography.
 *
 * Source of truth: docs/design-system.md — "Large amounts are the most
 * important numbers on the screen." The scale is deliberately small: amounts,
 * headings, labels and body copy, with hierarchy carried by size, colour and
 * tracking rather than by a long tail of sizes
 * (vercel-react-native-skills/rules/ui-styling.md).
 *
 * Font family is the bundled Plus Jakarta Sans variable font, embedded at
 * build time by the expo-font config plugin (see app.json). No runtime
 * `useFonts` loading.
 *
 * IMPORTANT — only two weights actually render on Android.
 *
 * The bundled file is a *variable* font with a `wght` axis from 200 to 800, but
 * React Native cannot address that axis: `fontVariation` is not part of
 * `TextStyle`, and a single bundled family has only one file for React Native's
 * font manager to resolve. Measured on Android at 360dp, weights 400, 500 and
 * 600 are byte-for-byte identical output (255 ink pixels for the same label)
 * and 700 and 800 are identical to each other (320 ink pixels). Android
 * synthesises the heavier step by smearing strokes; it never selects the real
 * Medium/SemiBold/Bold instances.
 *
 * So the scale below is authored as a genuine two-weight system — Regular for
 * supporting copy, Bold for anything structural — instead of pretending 400 /
 * 500 / 600 / 700 form a gradient. Adding more weight steps would create
 * hierarchy that does not exist on the platform the app ships to. If real
 * weights are ever wanted, ship static instances of the font and register them
 * as separate families; do not add more steps here.
 */

/**
 * Family name registered by the expo-font config plugin.
 *
 * The bundled file is the variable `PlusJakartaSans.ttf`, so weights come from
 * `fontWeight` rather than separate families.
 */
export const fontFamily = {
  sans: 'PlusJakartaSans',
} as const;

/**
 * Type scale.
 *
 * Sized against a 360dp-wide Android screen, where 360dp is the narrowest
 * width these phones are sold at. `display` at 44 keeps the hero amount the
 * loudest element without letting it crowd a 328dp-wide card, and `navLabel` at
 * 11 is the floor for anything the user has to read rather than infer.
 */
export const fontSize = {
  /** Hero monetary amount — the single most important number in the app. */
  display: 44,
  /** Screen title. Sits deliberately below `display` so the amount wins. */
  title: 27,
  /** Secondary total, e.g. this week's spend. */
  headline: 23,
  /** Card heading, e.g. an empty state's title. */
  title3: 17,
  /** Row title, default body. */
  body: 15,
  /** Supporting copy under a page title. */
  caption: 14,
  /** Section label above a group of values. Sentence case, never uppercase. */
  label: 13,
  /** Timestamps and other incidental metadata. */
  micro: 11,
  /** Bottom navigation labels. Supporting role, so deliberately small. */
  navLabel: 10,
} as const;

/**
 * Only two of these produce distinct rendering on Android — see the note at the
 * top of this file. `regular` is the file's default instance; `bold` is the
 * system-synthesised heavier step.
 */
export const fontWeight = {
  regular: '400',
  /** Kept as a named alias so intent reads correctly; renders as `regular`. */
  medium: '500',
  /** Kept as a named alias so intent reads correctly; renders as `regular`. */
  semibold: '600',
  bold: '700',
} as const;

/**
 * Line height as a multiplier.
 *
 * Leading is tight on the large sizes — a 44pt amount with 1.5 leading floats
 * inside its card — and opens up on running copy, where
 * ui-ux-pro-max puts body text in the 1.5–1.75 band.
 */
export const lineHeight = {
  /** Display sizes: numerals and headings. */
  tight: 1.12,
  /** Labels and card headings. */
  snug: 1.3,
  /** Running copy. */
  normal: 1.5,
} as const;

/**
 * Letter spacing.
 *
 * Negative tracking at display sizes keeps large type dense and deliberate —
 * the fix for a heading that reads like a default component — while small
 * labels need slightly positive tracking to stay legible at 11–13pt.
 */
export const letterSpacing = {
  /** Display and title sizes. */
  tight: -0.8,
  /** Headings and amounts between display and body. */
  snug: -0.4,
  /** Body copy. */
  normal: 0,
  /** Navigation labels and section labels: small type wants air. */
  wide: 0.1,
  /** True all-caps overlines, where case alone is not enough separation. */
  caps: 0.7,
} as const;

export const textVariants = {
  /**
   * Hero monetary amount.
   *
   * `fontVariant: ['tabular-nums']` keeps digits aligned so amounts can be
   * scanned vertically without jitter (docs/data-model.md, Currency).
   */
  display: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.display * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  /**
   * Page title.
   *
   * Deliberately 17pt below `display`: the screen title establishes where you
   * are, the amount below it is why you opened the app. Tight leading and
   * -0.8 tracking keep it from reading as a stock `Text` heading.
   */
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.title * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  /**
   * Secondary monetary amount.
   *
   * Bold like the hero, because it is still a financial figure; size and
   * placement carry the rest of the difference.
   */
  headline: {
    fontSize: fontSize.headline,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.headline * lineHeight.snug,
    letterSpacing: letterSpacing.snug,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
  },
  /** Card heading. */
  title3: {
    fontSize: fontSize.title3,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.title3 * lineHeight.snug,
    letterSpacing: letterSpacing.snug,
  },
  /** Row title, default body. */
  body: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.body * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Supporting copy. Always paired with a `secondary` tone by its caller. */
  caption: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.caption * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /**
   * Section label: "Spent today", "This week".
   *
   * Sentence case at a readable 13pt. The previous treatment was an 11pt
   * uppercase overline in the tertiary tone, which measured 3.9:1 against the
   * card fill — below the 4.5:1 floor ui-ux-pro-max sets for normal text — and
   * put three blocks of capitals on one screen.
   */
  label: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.label * lineHeight.snug,
    letterSpacing: letterSpacing.wide,
  },
  /** Timestamps and incidental metadata. */
  micro: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.micro * lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  /**
   * Bottom navigation label.
   *
   * A variant rather than a style override on `<Text>` for a concrete reason:
   * the primitive defaults to `body`, so overriding only `fontSize` left the
   * 15pt/1.5 body line-height — 22.5pt — attached to a 9pt label. The measured
   * result was an 11pt visual gap between the icon and the glyph and a label
   * that overflowed its own active pill. Owning the leading here fixes both.
   *
   * 10pt with slightly wider tracking than the rest of the scale: at nav label
   * size, extra letter spacing is what keeps the word readable and stops it
   * looking like a squeezed-down `body`. This is the floor of the scale, so it
   * is used only here.
   */
  navLabel: {
    fontSize: fontSize.navLabel,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.navLabel * lineHeight.snug,
    // 0.2 rather than the shared `wide` of 0.1: `wide` is also used by the
    // `label` variant on the dashboard, and this refinement is scoped to the
    // navigation bar only.
    letterSpacing: 0.2,
  },
  /**
   * True all-caps overline. Reserved for short, purely structural markers —
   * never for a label that carries meaning on its own, and not used on the
   * dashboard.
   */
  overline: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.micro * lineHeight.snug,
    letterSpacing: letterSpacing.caps,
    textTransform: 'uppercase',
  },
} as const;

export type TextVariant = keyof typeof textVariants;