import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BudgetProgressBar } from '@/components/budget/budget-progress-bar';
import { AmountField } from '@/components/expenses/amount-field';
import { GlassCard } from '@/components/glass/glass-card';
import { StatTile } from '@/components/dashboard/stat-tile';
import { ButtonLabel, GlassButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { getDatabase } from '@/database/database';
import { BudgetRepository, type Budget } from '@/database/repositories/budget-repository';
import { ExpenseRepository } from '@/database/repositories/expense-repository';
import { colors, spacing } from '@/theme';
import { computeBudgetProgress, currentMonthKey, formatMonthKey } from '@/utils/budget';
import { formatInr, parseAmountToPaise, sanitizeAmountInput } from '@/utils/currency';

/**
 * Budget.
 *
 * Shows the current month's budget against this month's spending, with a
 * progress bar and the remaining (or over-spent) amount. docs/screens.md also
 * requires the exceeded state to be unmistakable — it is carried by colour,
 * the percentage, and an explicit "over budget" line.
 *
 * State is local and re-read from SQLite on every focus, the same pattern
 * Analytics uses: the budget and the monthly total are derived from persisted
 * rows, so an add, edit or delete anywhere else is reflected the next time
 * this screen comes forward, and nothing is duplicated into Zustand.
 */

type LoadStatus = 'loading' | 'ready' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export default function BudgetScreen() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [monthKey, setMonthKey] = useState(() => currentMonthKey(new Date()));
  const [budget, setBudget] = useState<Budget | null>(null);
  const [spentPaise, setSpentPaise] = useState(0);

  const [editing, setEditing] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [validateAmount, setValidateAmount] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // See the Home dashboard for why a counter and not a boolean.
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const loadId = latestLoad.current + 1;
    latestLoad.current = loadId;

    try {
      // One clock reading drives both figures, so a month rollover between the
      // two queries cannot pair this month's budget with last month's spend.
      const reference = new Date();
      const month = currentMonthKey(reference);

      const database = await getDatabase();
      const [nextBudget, summary] = await Promise.all([
        new BudgetRepository(database).getBudget(month),
        new ExpenseRepository(database).getSummary(reference),
      ]);

      if (latestLoad.current !== loadId) {
        return;
      }

      setMonthKey(month);
      setBudget(nextBudget);
      setSpentPaise(summary.monthPaise);
      setStatus('ready');
    } catch (error) {
      if (latestLoad.current !== loadId) {
        return;
      }

      // The last good figures stay on screen rather than being wiped by a
      // failed refresh.
      console.warn('[budget] could not load the budget', error);
      setStatus('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const amountPaise = parseAmountToPaise(amountText);
  const amountProblem = amountPaise == null || amountPaise <= 0;
  const amountError = validateAmount
    ? amountProblem
      ? describeAmountProblem(amountText, amountPaise)
      : null
    : null;

  const openEditor = useCallback(() => {
    // Seed from the stored budget so editing is a small change, not a retype.
    setAmountText(budget == null ? '' : (budget.amountMinor / 100).toFixed(2));
    setValidateAmount(false);
    setSaveStatus('idle');
    setEditing(true);
  }, [budget]);

  const closeEditor = useCallback(() => {
    setEditing(false);
    setValidateAmount(false);
    setSaveStatus('idle');
  }, []);

  const handleAmountChange = useCallback((next: string) => {
    setAmountText(sanitizeAmountInput(next));
  }, []);

  const handleSave = useCallback(async () => {
    if (amountProblem) {
      setValidateAmount(true);
      return;
    }

    setSaveStatus('saving');

    try {
      const repository = new BudgetRepository(await getDatabase());
      await repository.setMonthlyBudget({ monthKey, amountPaise: amountPaise as number });
      setSaveStatus('saved');
      setEditing(false);
      await load();
    } catch (error) {
      console.warn('[budget] could not save the budget', error);
      setSaveStatus('failed');
    }
  }, [amountProblem, amountPaise, load, monthKey]);

  const progress =
    budget == null ? null : computeBudgetProgress(budget.amountMinor, spentPaise);

  const showInitialLoading = status === 'loading' && budget == null;
  const showError = status === 'error' && budget == null;

  return (
    <Screen testID="screen-budget">
      <ScreenHeader title="Budget" subtitle="Control monthly spending" />

      {showInitialLoading ? (
        <View style={styles.centered} testID="budget-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : showError ? (
        <EmptyState
          testID="budget-error"
          title="Could not read your budget"
          body="Your data is still on this device. Try again in a moment."
          action={
            <GlassButton
              accessibilityLabel="Retry loading budget"
              accessibilityHint="Reads the budget again"
              onPress={load}
              testID="budget-retry"
            >
              <ButtonLabel>Try again</ButtonLabel>
            </GlassButton>
          }
        />
      ) : editing ? (
        <GlassCard testID="budget-editor">
          <AmountField
            value={amountText}
            onChangeText={handleAmountChange}
            error={amountError}
            testID="budget-amount-field"
          />

          {saveStatus === 'failed' ? (
            <Text
              variant="caption"
              tone="destructive"
              accessibilityLiveRegion="assertive"
              testID="budget-save-error"
            >
              Could not save. Check your storage and try again.
            </Text>
          ) : null}

          <View style={styles.editorActions}>
            <GlassButton
              variant="secondary"
              onPress={closeEditor}
              accessibilityLabel="Cancel"
              accessibilityHint="Close the budget editor without saving"
              testID="budget-cancel"
            >
              <ButtonLabel variant="secondary">Cancel</ButtonLabel>
            </GlassButton>

            <GlassButton
              onPress={handleSave}
              loading={saveStatus === 'saving'}
              disabled={saveStatus === 'saving'}
              accessibilityLabel={budget == null ? 'Save budget' : 'Save changes'}
              accessibilityHint="Stores this as the monthly budget"
              testID="budget-save"
            >
              <ButtonLabel>{budget == null ? 'Save budget' : 'Save changes'}</ButtonLabel>
            </GlassButton>
          </View>
        </GlassCard>
      ) : budget == null || progress == null ? (
        <EmptyState
          testID="empty-budget"
          title="No budget set"
          body="Set a monthly budget and this screen shows how much of it is left as you spend."
          action={
            <GlassButton
              accessibilityLabel="Set monthly budget"
              accessibilityHint="Opens the budget amount editor"
              onPress={openEditor}
              testID="empty-budget-set"
            >
              <ButtonLabel>Set budget</ButtonLabel>
            </GlassButton>
          }
        />
      ) : (
        <>
          <GlassCard testID="budget-summary">
            <Text variant="label" tone="secondary">
              {`Monthly budget · ${formatMonthKey(monthKey)}`}
            </Text>

            <Text variant="display" tabular testID="budget-amount">
              {formatInr(progress.budgetPaise)}
            </Text>

            <BudgetProgressBar
              fraction={progress.visualFraction}
              exceeded={progress.exceeded}
              nearlySpent={!progress.exceeded && progress.percentUsed >= 80}
              accessibilityLabel="Budget used"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(Math.min(100, progress.percentUsed)),
                text: `${Math.round(progress.percentUsed)} percent of your budget used`,
              }}
              testID="budget-progress"
            />

            <Text
              variant="caption"
              tone={progress.exceeded ? 'destructive' : 'secondary'}
              accessibilityLiveRegion="polite"
              testID="budget-percent"
            >
              {progress.exceeded
                ? `${Math.round(progress.percentUsed)}% used · over budget by ${formatInr(-progress.remainingPaise)}`
                : `${Math.round(progress.percentUsed)}% used`}
            </Text>
          </GlassCard>

          <View style={styles.tiles}>
            <StatTile
              label="Spent this month"
              value={formatInr(progress.spentPaise)}
              testID="budget-spent"
            />
            <StatTile
              label={progress.exceeded ? 'Over budget' : 'Remaining'}
              value={formatInr(Math.abs(progress.remainingPaise))}
              testID="budget-remaining"
            />
          </View>

          <GlassButton
            variant="secondary"
            onPress={openEditor}
            accessibilityLabel="Edit budget"
            accessibilityHint="Opens the budget amount editor"
            testID="budget-edit"
          >
            <ButtonLabel variant="secondary">Edit budget</ButtonLabel>
          </GlassButton>
        </>
      )}
    </Screen>
  );
}

/**
 * Turn an unreadable amount into something the user can act on. Same
 * distinction as the expense form: "not entered" and "entered but zero" are
 * different mistakes.
 */
function describeAmountProblem(input: string, paise: number | null): string {
  if (paise != null && paise > 0) {
    return '';
  }

  if (paise === 0) {
    return 'Budget must be more than ₹0';
  }

  return input.trim() === '' ? 'Enter a budget amount' : 'Enter a valid amount';
}

const styles = StyleSheet.create({
  centered: {
    paddingTop: spacing.xxl,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
});
