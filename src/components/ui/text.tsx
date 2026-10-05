import { StyleSheet, Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { colors, fontFamily, textVariants, type TextVariant } from '@/theme';

/** Semantic colour roles. Keeps screens from hard-coding hex values. */
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'positive' | 'warning' | 'destructive' | 'onAccent';

const toneColor: Record<TextTone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  accent: colors.accent,
  positive: colors.positive,
  warning: colors.warning,
  destructive: colors.destructive,
  onAccent: colors.textOnAccent,
};

export type TextProps = {
  variant?: TextVariant;
  tone?: TextTone;
  /** Force tabular numerals — used for any money value. */
  tabular?: boolean;
  /** Centre the text. */
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
  /** Forwarded accessibility props. */
  accessibilityRole?: 'header' | 'text';
  accessibilityLabel?: string;
  testID?: string;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  selectable?: boolean;
};

/**
 * The app's only text primitive.
 *
 * Enforces the bundled font and the variant scale so no screen invents its own
 * type styles. Strings must always be rendered inside a `Text` — React Native
 * throws otherwise
 * (vercel-react-native-skills/rules/rendering-text-in-text-component.md).
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  tabular = false,
  center = false,
  style,
  children,
  accessibilityRole,
  accessibilityLabel,
  testID,
  numberOfLines,
  ellipsizeMode,
  selectable = false,
}: TextProps) {
  return (
    <RNText
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      selectable={selectable}
      style={[
        styles.base,
        textVariants[variant],
        { color: toneColor[tone] },
        tabular && styles.tabular,
        center && styles.center,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fontFamily.sans,
  },
  tabular: {
    // Keeps digits column-aligned so amounts can be scanned vertically.
    fontVariant: ['tabular-nums'],
  },
  center: {
    textAlign: 'center',
  },
});