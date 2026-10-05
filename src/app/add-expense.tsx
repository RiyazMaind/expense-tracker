import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountField } from '@/components/expenses/amount-field';
import { CategoryPicker } from '@/components/expenses/category-picker';
import { DatePicker } from '@/components/expenses/date-picker';
import { NoteField } from '@/components/expenses/note-field';
import { ButtonIcon, ButtonLabel, GlassButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DEFAULT_CATEGORY_ID, type CategoryId } from '@/constants/categories';
import { borders, colors, radii, spacing, touchTarget } from '@/theme';
import { formatInr, parseAmountToPaise, sanitizeAmountInput } from '@/utils/currency';
import { formatFullDate, fromDateKey, toDateKey } from '@/utils/dates';

/**
 * How long the confirmation holds before returning to the previous screen.
 *
 * Tuned by feel on device: at 850ms the button flipped to "Added" and the screen
 * was already gone before it registered, which left the flow feeling like it had
 * simply jumped somewhere. 1.2s is long enough to read the confirmation line, and
 * short enough that it never feels like a stall. The haptic fires immediately
 * and carries most of the feedback, so this is only the visual tail.
 */
const SAVED_FEEDBACK_MS = 1200;

type ExpenseDraft = {
  amountPaise: number;
  category: CategoryId;
  dateKey: string;
  note: string | null;
};

/**
 * Add Expense.
 *
 * docs/screens.md: "Purpose: record an expense quickly", with the amount
 * autofocusing and the save action obvious. Everything below follows from that.
 *
 * Persistence is deliberately absent — docs/roadmap.md puts the database in
 * Phase 2 and entry in Phase 3, and this task asked for entry without it. The
 * draft is assembled and logged, and no `expenses` row is written. The shape it
 * logs is already the one the repository will want: whole paise, a category id,
 * a `YYYY-MM-DD` local date key, and a nullable note.
 */
export default function AddExpenseScreen() {
  // Destructured for React Compiler stability.
  const { back } = useRouter();
  const insets = useSafeAreaInsets();
  const amountRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Ground truth only. Every message and every disabled state below is derived,
   * so an error can never disagree with the field it is describing.
   */
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<CategoryId>(DEFAULT_CATEGORY_ID);
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [note, setNote] = useState('');
  const [validateAmount, setValidateAmount] = useState(false);
  const [saved, setSaved] = useState(false);

  const amountPaise = parseAmountToPaise(amountText);
  const amountProblem = amountPaise == null || amountPaise <= 0;

  // Only surfaced once a save has been attempted, so the field never scolds the
  // user mid-keystroke — typing "0." on the way to "0.50" is not an error.
  const amountError = validateAmount ? describeAmountProblem(amountText, amountPaise) : null;

  const resolvedDateLabel = useMemo(
    () => formatFullDate(fromDateKey(dateKey)),
    [dateKey],
  );

  useEffect(() => {
    return () => {
      if (dismissTimer.current != null) {
        clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  const handleChangeAmount = useCallback((next: string) => {
    setAmountText(sanitizeAmountInput(next));
  }, []);

  const handleClearNote = useCallback(() => {
    setNote('');
    // Return focus so clearing does not leave the keyboard dismissed mid-entry.
    noteRef.current?.focus();
  }, []);

  const handleSave = useCallback(() => {
    if (amountProblem) {
      setValidateAmount(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
        // Haptics are unavailable on web and some devices. Never block the save.
      });
      // Send the user to the thing that needs fixing rather than making them
      // find it.
      amountRef.current?.focus();
      return;
    }

    const draft: ExpenseDraft = {
      amountPaise: amountPaise as number,
      category,
      dateKey,
      note: note.trim() === '' ? null : note.trim(),
    };

    // No SQLite yet. Replace with the expense repository in the database phase.
    console.log('[add-expense] saved', draft);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      // Haptics are unavailable on web and some devices.
    });

    setSaved(true);
    dismissTimer.current = setTimeout(() => back(), SAVED_FEEDBACK_MS);
  }, [amountProblem, amountPaise, back, category, dateKey, note]);

  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    back();
  }, [back]);

  return (
    <KeyboardAvoidingView
      // Android resizes the window for the keyboard, so `flex: 1` already does
      // the work there; `height` on top of it double-counts and squashes the
      // layout.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={handleCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityHint="Go back without saving"
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          testID="cancel-button"
        >
          <Icon name="close" size={18} color={colors.textSecondary} />
        </Pressable>

        <Text variant="title3" center accessibilityRole="header">
          Add expense
        </Text>

        {/*
          Balances the leading cancel button so the title sits on the screen's
          centre line rather than drifting right. A spacer rather than a second
          button — there is nothing useful to put there.
        */}
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        // A tap on a chip or the date row must register even while the keypad is
        // up. Without this the first tap only dismisses the keyboard, which adds
        // a hidden action to the shortest flow in the app.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        testID="add-expense-scroll"
      >
        <AmountField
          ref={amountRef}
          value={amountText}
          onChangeText={handleChangeAmount}
          error={amountError}
          onSubmit={Keyboard.dismiss}
          testID="amount-field"
        />

        <View style={styles.section}>
          <CategoryPicker
            value={category}
            onChange={setCategory}
            testID="category-picker"
          />
        </View>

        <View style={styles.section}>
          <DatePicker value={dateKey} onChange={setDateKey} testID="date-picker" />
        </View>

        <NoteField
          ref={noteRef}
          value={note}
          onChangeText={setNote}
          onSubmit={Keyboard.dismiss}
          onClear={handleClearNote}
          testID="note-field"
        />
      </ScrollView>

      {/*
        The primary action is docked rather than scrolled, because
        docs/screens.md requires the save action to be obvious and a CTA below
        the fold is invisible until the user scrolls to find it. Docking also
        keeps it inside thumb reach, and inside the space left above the
        keyboard, so "type, pick category, save" is three taps with no scrolling
        on a 360x640 screen.
      */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {/*
          The confirmation lives in the dock, directly above the button it
          replaces, rather than at the end of the scroll content. At the bottom
          of the list it sat below the fold on a 640dp screen, so the one moment
          worth confirming — that the right amount landed on the right day — was
          the moment the screen was on its way away.

          It also restates the date in words. The date chips are abbreviated and
          a mistapped date is the easiest mistake to make here and the hardest to
          notice later.
        */}
        {saved ? (
          <Text
            variant="caption"
            tone="positive"
            center
            accessibilityLiveRegion="polite"
            style={styles.savedSummary}
            testID="saved-summary"
          >
            {`Added ${formatInr(amountPaise as number)} on ${resolvedDateLabel}`}
          </Text>
        ) : null}

        <GlassButton
          block
          size="lg"
          variant="primary"
          onPress={handleSave}
          disabled={saved}
          haptic={false}
          accessibilityLabel={
            saved ? 'Expense added' : 'Add expense'
          }
          accessibilityHint={
            saved
              ? 'Returning to the previous screen'
              : amountProblem
                ? 'Enter an amount greater than zero first'
                : 'Saves this expense'
          }
          testID="save-button"
        >
          {saved ? (
            <>
              <ButtonIcon>
                <Icon name="check" size={18} color={colors.textOnAccent} />
              </ButtonIcon>
              <ButtonLabel>Added</ButtonLabel>
            </>
          ) : (
            <>
              <ButtonIcon>
                <Icon name="plus" size={18} color={colors.textOnAccent} />
              </ButtonIcon>
              <ButtonLabel>Add expense</ButtonLabel>
            </>
          )}
        </GlassButton>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Turn an unreadable amount into something the user can act on.
 *
 * "not entered" and "entered but zero" get different copy: they are different
 * mistakes, and telling them apart is most of the fix. docs/data-model.md
 * requires a positive amount for a normal expense, so zero is rejected rather
 * than silently saved.
 */
function describeAmountProblem(input: string, paise: number | null): string {
  if (paise != null && paise > 0) {
    return '';
  }

  if (paise === 0) {
    return 'Amount must be more than ₹0';
  }

  return input.trim() === '' ? 'Enter an amount to continue' : 'Enter a valid amount';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    // Opaque, so scrolled fields pass underneath instead of showing through.
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: borders.subtle,
  },
  headerButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  pressed: {
    opacity: 0.7,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    // The header already separates itself from the first field, so the scroll
    // body can start tighter than it would with a bare padding. That reclaimed
    // space is what keeps the date chips on screen next to their own label
    // instead of leaving an orphaned "Date" heading at the fold.
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // Opaque dock rather than glass: the CTA sits on top of scrolling content,
    // and a translucent bar would let fields pass behind the label.
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: borders.subtle,
  },
  savedSummary: {
    marginBottom: spacing.sm,
  },
});