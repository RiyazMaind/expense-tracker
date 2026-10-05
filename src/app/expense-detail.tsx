import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DEFAULT_CATEGORY_ID, type CategoryId } from '@/constants/categories';
import { getDatabase } from '@/database/database';
import {
  ExpenseRepository,
  type Expense,
  type NewExpense,
} from '@/database/repositories/expense-repository';
import { useExpenseStore } from '@/store/expenseStore';
import { borders, colors, radii, spacing, touchTarget } from '@/theme';
import { parseAmountToPaise, sanitizeAmountInput } from '@/utils/currency';
import { toDateKey } from '@/utils/dates';

/**
 * Expense detail — view, edit and delete one transaction.
 *
 * docs/screens.md asks the history list for a way to reach both editing and
 * deletion, and this is that destination. It reuses the exact field components the
 * add screen uses rather than a second set of inputs: two forms for the same
 * fields would drift apart on validation and on what a blank note means.
 *
 * The expense is read from SQLite by id on entry and every change is written back
 * through `ExpenseRepository.update`, so this screen never edits a row it is
 * holding locally and SQLite stays the single source of truth
 * (docs/architecture.md). There is no "unsaved changes" prompt, because there is
 * nothing to reconcile: either the write landed, or the screen says it did not.
 */

/**
 * Lifecycle of a destructive-or-not write, plus the load.
 *
 * `loading` and `missing` are separate from `SaveState` because a missing expense
 * is not a failure to load — it is a fact about the row, and the screen has to
 * say which of the two happened. Both write states are guarded together on the
 * buttons: an expense may be saved or deleted, never both in flight.
 */
type ScreenStatus = 'loading' | 'ready' | 'missing';
type SaveState = 'idle' | 'saving' | 'failed' | 'deleting';

export default function ExpenseDetailScreen() {
  // Destructured for React Compiler stability.
  const { back } = useRouter();
  const insets = useSafeAreaInsets();
  const amountRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;

  /*
    `null` rather than a sentinel id. A route param is user-reachable data, so it
    may be absent, non-numeric or nonsense, and none of those can become a query.
    Deriving "there is nothing to load" during render keeps that a fact about the
    params instead of a state this screen has to write and then keep in step.
  */
  const expenseId = parseExpenseId(idParam);

  const [status, setStatus] = useState<ScreenStatus>('loading');
  const [amountText, setAmountText] = useState('');
  /*
    Seeded with a real category rather than a nullable one. The form is only
    rendered once the expense has loaded and replaced this value, so the seed is
    never visible — but making it a real `CategoryId` means the picker is always
    given something valid, instead of every field component having to defend
    against an empty selection.
  */
  const [category, setCategory] = useState<CategoryId>(DEFAULT_CATEGORY_ID);
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [note, setNote] = useState('');
  const [validateAmount, setValidateAmount] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const busy = saveState === 'saving' || saveState === 'deleting';

  const amountPaise = parseAmountToPaise(amountText);
  const amountProblem = amountPaise == null || amountPaise <= 0;

  // Only surfaced once a save has been attempted, matching the add screen.
  const amountError =
    validateAmount && amountProblem ? describeAmountProblem(amountText, amountPaise) : null;

  /**
   * Fill the form from the stored row.
   *
   * The amount is re-rendered from paise rather than kept as the text the user
   * typed, so what is on screen is exactly what was persisted — including the
   * `.00` a typed "40" never had.
   */
  const hydrate = useCallback((expense: Expense) => {
    setAmountText((expense.amountMinor / 100).toFixed(2));
    setCategory(expense.category);
    setDateKey(expense.date);
    setNote(expense.note ?? '');
  }, []);

  useEffect(() => {
    // Nothing to ask the database; rendered as "missing" directly.
    if (expenseId == null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const repository = new ExpenseRepository(await getDatabase());
        const expense = await repository.getById(expenseId);

        if (cancelled) {
          return;
        }

        if (expense == null) {
          setStatus('missing');
          return;
        }

        hydrate(expense);
        setStatus('ready');
      } catch (error) {
        if (!cancelled) {
          console.warn('[expense-detail] could not load the expense', error);
          setStatus('missing');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expenseId, hydrate]);

  const handleChangeAmount = useCallback((next: string) => {
    setAmountText(sanitizeAmountInput(next));
  }, []);

  const handleClearNote = useCallback(() => {
    setNote('');
    noteRef.current?.focus();
  }, []);

  /**
   * Home's figures are a cache, so a screen that changes the data is responsible
   * for invalidating it. Reading the action off the store directly rather than
   * subscribing to it keeps this screen from re-rendering every time the summary
   * updates — it has no interest in the summary
   * (vercel-react-native-skills/rules/rerender-dependencies.md).
   */
  const refreshSummary = useCallback(() => {
    useExpenseStore.getState().loadSummary();
  }, []);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    back();
  }, [back]);

  const handleSave = useCallback(async () => {
    // The form is only rendered for a usable id, so this cannot fire otherwise.
    // It is here because the id is `number | null` and a route param is
    // user-reachable data — the screen should have no path to a query it cannot
    // build.
    if (expenseId == null) {
      return;
    }

    if (amountProblem) {
      setValidateAmount(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
        // Haptics are unavailable on web and some devices.
      });
      amountRef.current?.focus();
      return;
    }

    const draft: NewExpense = {
      amountPaise: amountPaise as number,
      category,
      dateKey,
      note: note.trim() === '' ? null : note.trim(),
    };

    // Set before awaiting, so a second tap inside the native round trip cannot
    // write the same edit twice.
    setSaveState('saving');

    try {
      const repository = new ExpenseRepository(await getDatabase());
      const updated = await repository.update(expenseId, draft);

      /*
        Re-hydrate from the row as stored. `update` is what normalizes the note,
        so anything left on screen that disagrees with it would be a lie — this
        is cheap and it means the fields always describe the database.
      */
      hydrate(updated);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        // Haptics are unavailable on web and some devices.
      });

      refreshSummary();
      // Straight back: the history list re-reads on focus, so the updated row is
      // already waiting as confirmation. A dwelled-on "Saved" state would only
      // delay seeing the result of the edit.
      back();
    } catch (error) {
      /*
        The row is unchanged in SQLite, so this must not navigate away and must
        not claim success. `idle` rather than a retry-flavoured state: the form
        still holds what the user typed, so pressing save again is the fix.
      */
      console.warn('[expense-detail] could not save the changes', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        // Haptics are unavailable on web and some devices.
      });
      setSaveState('failed');
    }
  }, [amountProblem, amountPaise, back, category, dateKey, expenseId, hydrate, note, refreshSummary]);

  /**
   * Deletion is confirmed rather than immediate.
   *
   * There is no undo, and a single mis-tap destroys a record the user may have
   * typed from a receipt. The alert names the amount, so it is unambiguous which
   * expense is about to go.
   */
  const handleDelete = useCallback(async () => {
    // Same reasoning as `handleSave`: unreachable from the rendered UI, and not
    // something to trust silently when the id came from a URL.
    if (expenseId == null) {
      return;
    }

    setSaveState('deleting');

    try {
      const repository = new ExpenseRepository(await getDatabase());
      const removed = await repository.remove(expenseId);

      if (!removed) {
        // Already gone — deleted from somewhere else. Nothing left to do, and
        // reporting a failure would be wrong, since the row is gone either way.
        console.warn(`[expense-detail] expense ${expenseId} was already deleted`);
      }

      refreshSummary();
      back();
    } catch (error) {
      // The row is still there, so stay put and say so.
      console.warn('[expense-detail] could not delete the expense', error);
      setSaveState('failed');
    }
  }, [back, expenseId, refreshSummary]);

  const handleDeleteRequest = useCallback(() => {
    const amount = parseAmountToPaise(amountText);

    Alert.alert(
      'Delete this expense?',
      amount == null
        ? 'This cannot be undone.'
        : `${(amount / 100).toFixed(2)} will be removed from your history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void handleDelete() },
      ],
    );
  }, [amountText, handleDelete]);

  const header = useMemo(
    () => (
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          accessibilityHint="Go back without saving changes"
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          testID="detail-close"
        >
          <Icon name="close" size={18} color={colors.textSecondary} />
        </Pressable>

        <Text variant="title3" center accessibilityRole="header">
          Edit expense
        </Text>

        {/* Balances the leading button so the title sits on the centre line. */}
        <View style={styles.headerButton} />
      </View>
    ),
    [handleClose, insets.top],
  );

  const missingBody = (
    <View style={styles.missing}>
      <EmptyState
        testID="detail-missing"
        title="Expense not found"
        body="It may have already been deleted from another screen."
        action={
          <GlassButton
            accessibilityLabel="Back to expenses"
            accessibilityHint="Returns to your expense history"
            onPress={handleClose}
            testID="detail-missing-back"
          >
            <ButtonLabel>Back to expenses</ButtonLabel>
          </GlassButton>
        }
      />
    </View>
  );

  /*
    Checked before the loading branch. An unusable id never starts a load, so it
    would otherwise sit on the spinner forever waiting for a read that was never
    issued.
  */
  if (expenseId == null) {
    return (
      <View style={styles.root} testID="screen-expense-detail">
        {header}
        {missingBody}
      </View>
    );
  }

  if (status === 'loading') {
    return (
      <View style={styles.root} testID="screen-expense-detail">
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} testID="detail-loading" />
        </View>
      </View>
    );
  }

  if (status === 'missing') {
    return (
      <View style={styles.root} testID="screen-expense-detail">
        {header}
        {missingBody}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {header}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        testID="detail-scroll"
      >
        <AmountField
          ref={amountRef}
          value={amountText}
          onChangeText={handleChangeAmount}
          error={amountError}
          onSubmit={Keyboard.dismiss}
          testID="detail-amount-field"
        />

        <View style={styles.section}>
          <CategoryPicker
            value={category}
            onChange={setCategory}
            testID="detail-category-picker"
          />
        </View>

        <View style={styles.section}>
          <DatePicker value={dateKey} onChange={setDateKey} testID="detail-date-picker" />
        </View>

        <NoteField
          ref={noteRef}
          value={note}
          onChangeText={setNote}
          onSubmit={Keyboard.dismiss}
          onClear={handleClearNote}
          testID="detail-note-field"
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {saveState === 'failed' ? (
          <Text
            variant="caption"
            tone="destructive"
            center
            accessibilityLiveRegion="assertive"
            style={styles.message}
            testID="detail-error"
          >
            Could not save your changes. Check your storage and try again.
          </Text>
        ) : null}

        <GlassButton
          block
          size="lg"
          variant="primary"
          onPress={handleSave}
          disabled={busy}
          haptic={false}
          accessibilityLabel="Save changes"
          accessibilityHint="Writes these changes to your expense history"
          testID="detail-save-button"
        >
          {saveState === 'saving' ? (
            <ButtonLabel>Saving…</ButtonLabel>
          ) : (
            <>
              <ButtonIcon>
                <Icon name="check" size={18} color={colors.textOnAccent} />
              </ButtonIcon>
              <ButtonLabel>Save changes</ButtonLabel>
            </>
          )}
        </GlassButton>

        {/*
          Destructive, so it is a separate, quieter control below the primary
          action rather than a second button beside it. A user confirming an edit
          should never be one mis-tap from losing the record.
        */}
        <GlassButton
          block
          variant="destructive"
          onPress={handleDeleteRequest}
          disabled={busy}
          haptic={false}
          accessibilityLabel="Delete expense"
          accessibilityHint="Asks for confirmation, then removes this expense"
          testID="detail-delete-button"
        >
          {saveState === 'deleting' ? (
            <ButtonLabel>Deleting…</ButtonLabel>
          ) : (
            <>
              <ButtonIcon>
                <Icon name="trash" size={18} color={colors.textOnAccent} />
              </ButtonIcon>
              <ButtonLabel>Delete expense</ButtonLabel>
            </>
          )}
        </GlassButton>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Read an expense id out of a route param.
 *
 * Returns `null` for anything that is not a positive whole number, so an
 * unusable id never reaches the database. `Number('')` is 0 and `Number('12abc')`
 * is `NaN`, so the empty and half-typed cases are rejected by the same check
 * rather than each needing their own.
 */
function parseExpenseId(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') {
    return null;
  }

  const id = Number(raw);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Turn an unreadable amount into something the user can act on. Same copy and
 * same reasoning as the add screen: "not entered" and "entered but zero" are
 * different mistakes.
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    // Opaque dock rather than glass: the actions sit over scrolling content.
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: borders.subtle,
  },
  message: {
    marginBottom: spacing.xxs,
  },
});