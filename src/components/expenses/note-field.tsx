import type { Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, fontFamily, radii, spacing, textVariants, touchTarget } from '@/theme';

export type NoteFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  /** Fired on done, so the screen can dismiss the keyboard. */
  onSubmit?: () => void;
  onClear?: () => void;
  ref?: Ref<TextInput>;
  testID?: string;
};

/**
 * Optional note.
 *
 * docs/data-model.md types `note` as optional, so the field says so plainly and
 * carries no validation. It is the last field on the screen for a reason: it is
 * the only one most entries skip, so burying it keeps the required path short.
 *
 * Single-line rather than multiline. A growing note box would push the category
 * grid around while typing and shrink the area left above the keyboard, for a
 * field that is a memory aid, not a journal.
 */
export function NoteField({
  value,
  onChangeText,
  onSubmit,
  onClear,
  ref,
  testID,
}: NoteFieldProps) {
  const hasValue = value.length > 0;

  return (
    <GlassSurface
      level="subtle"
      borderLevel="subtle"
      radius={radii.lg}
      shadow="sm"
      testID={testID}
    >
      <View style={styles.inner}>
        <View style={styles.labelRow}>
          <Text variant="label" tone="secondary">
            Note
          </Text>
          <Text variant="micro" tone="tertiary">
            Optional
          </Text>
        </View>

        <View style={styles.row}>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            placeholder="What was it for?"
            placeholderTextColor={colors.textTertiary}
            maxLength={60}
            returnKeyType="done"
            blurOnSubmit
            selectionColor={colors.accent}
            underlineColorAndroid="transparent"
            style={styles.input}
            accessibilityLabel="Note, optional"
            accessibilityHint="Add a short description of the expense"
            testID="note-input"
          />

          {/*
            Only mounted once there is something to clear. A permanently
            reserved clear button would leave a dead 44pt target on screen for
            every entry that skips the note — and an inactive-looking control in
            the tap path invites mis-taps.
          */}
          {hasValue && onClear ? (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear note"
              style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
              testID="note-clear"
            >
              <Icon name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    ...textVariants.body,
    fontFamily: fontFamily.sans,
    // Required: a TextInput inside a row sizes to its text, not to the row. Left
    // unset it collapsed to roughly the width of the placeholder, leaving most
    // of the field dead to the touch.
    flex: 1,
    color: colors.text,
    padding: 0,
    margin: 0,
    minHeight: touchTarget.min,
    textAlignVertical: 'center',
  },
  clear: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
    borderRadius: radii.pill,
  },
  pressed: {
    opacity: 0.7,
  },
});