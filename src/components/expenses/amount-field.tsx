import type { Ref } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Text } from '@/components/ui/text';
import { colors, fontFamily, radii, spacing, textVariants } from '@/theme';
import { MAX_DECIMAL_DIGITS, MAX_RUPEE_DIGITS } from '@/utils/currency';

export type AmountFieldProps = {
  /** Sanitized display string, not a number. The screen owns this. */
  value: string;
  onChangeText: (next: string) => void;
  /** Validation message, or null while the amount is acceptable. */
  error: string | null;
  /** Fired on the keyboard's done action. */
  onSubmit?: () => void;
  /** Lets the screen focus or refocus the field to show a validation failure. */
  ref?: Ref<TextInput>;
  testID?: string;
};

/**
 * The amount field: the largest control in the app and the reason this screen
 * exists.
 *
 * docs/screens.md is unambiguous about the intent — "The amount input should
 * receive focus quickly and the save action should be obvious" — so this field
 * autofocuses, opens the numeric keypad, and is set at the `display` type size:
 * the same scale as the dashboard hero, so the number the user is typing is
 * read at the same weight as the totals it will move.
 *
 * It is deliberately *not* a larger bespoke size. typography.ts keeps the scale
 * small on purpose, and a new step here would make this screen disagree with
 * Home about what the biggest number in the app looks like.
 */
export function AmountField({
  value,
  onChangeText,
  error,
  onSubmit,
  ref,
  testID,
}: AmountFieldProps) {
  const hasError = error != null;

  return (
    <GlassSurface
      level="default"
      radius={radii.xl}
      shadow="md"
      highlighted={!hasError}
      borderLevel={hasError ? 'strong' : 'default'}
      testID={testID}
      style={[styles.surface, hasError && styles.surfaceError]}
    >
      <View style={[styles.topSheen, hasError ? styles.sheenError : styles.sheenNormal]} />
      <View style={styles.inner}>
        <Text variant="label" tone="secondary">
          Amount
        </Text>

        {/*
          Left-aligned rather than centred: the rupee sign sits beside the digits
          instead of both sliding sideways as the number grows, which is what a
          centred hero amount does on every keystroke.
        */}
        <View style={styles.row}>
          <Text variant="display" style={styles.currencySymbol}>
            ₹
          </Text>

          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            // decimal-pad on both platforms: no sign, no exponent, and on iOS it
            // swaps in the numeric keypad rather than the full keyboard.
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            // Focus immediately — docs/screens.md asks for it explicitly.
            autoFocus
            // Deliberately no `selectTextOnFocus`: it selected the whole
            // amount every time the field was refocused, so the next digit
            // typed replaced the first one and the entry had to be retyped.
            // The cursor simply lands where the user taps.
            maxLength={MAX_RUPEE_DIGITS + 1 + MAX_DECIMAL_DIGITS}
            returnKeyType="done"
            blurOnSubmit
            selectionColor={colors.accent}
            underlineColorAndroid="transparent"
            style={styles.input}
            accessibilityLabel="Amount in rupees"
            accessibilityHint="Enter what you spent. The number keypad opens automatically."
            testID="amount-input"
          />
        </View>

        {/*
          The line is always present and only its content changes. Reserving the
          space means a validation error appearing under the field does not push
          the category grid — and the user's thumb — down the screen.
        */}
        <View style={styles.status}>
          {hasError ? (
            <Text
              variant="caption"
              tone="destructive"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              testID="amount-error"
            >
              {error}
            </Text>
          ) : null}
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
  },
  surfaceError: {
    borderWidth: 1,
    borderColor: colors.destructive,
  },
  topSheen: {
    height: 2,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  sheenNormal: {
    backgroundColor: colors.accent,
    opacity: 0.6,
  },
  sheenError: {
    backgroundColor: colors.destructive,
    opacity: 0.9,
  },
  inner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currencySymbol: {
    color: colors.accent,
    fontWeight: '700',
  },
  input: {
    ...textVariants.display,
    fontFamily: fontFamily.sans,
    flex: 1,
    color: colors.text,
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
  },
  status: {
    minHeight: 21,
  },
});