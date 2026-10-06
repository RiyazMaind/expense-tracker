import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { GlassCard } from '@/components/glass/glass-card';
import { ButtonLabel, GlassButton } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { getDatabase } from '@/database/database';
import {
  buildExport,
  deleteAllData,
  importData,
  parseImport,
  serializeExport,
} from '@/services/data-transfer';
import { useExpenseStore } from '@/store/expenseStore';
import { colors, spacing, touchTarget } from '@/theme';

type DataStatus =
  | { kind: 'idle' }
  | { kind: 'working'; label: string }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

/** Written in plain branches, not a template-built value, so React Compiler accepts it. */
function describeImport(result: {
  expensesInserted: number;
  budgetsInserted: number;
  expensesSkippedDuplicate: number;
  budgetsSkippedDuplicate: number;
  expensesSkippedConflict: number;
  budgetsSkippedConflict: number;
}): string {
  const parts = [`Restored ${result.expensesInserted} expenses and ${result.budgetsInserted} budgets.`];

  const duplicates = result.expensesSkippedDuplicate + result.budgetsSkippedDuplicate;
  if (duplicates > 0) {
    parts.push(`Skipped ${duplicates} duplicates.`);
  }

  const conflicts = result.expensesSkippedConflict + result.budgetsSkippedConflict;
  if (conflicts > 0) {
    parts.push(`Kept local data for ${conflicts} conflicts.`);
  }

  return parts.join(' ');
}

/**
 * Settings.
 *
 * The MVP has no server to configure, so this screen is mostly *information
 * about where the data lives* — dark-only, local-only, offline — plus the three
 * data-safety actions: export, import, delete everything. Nothing here talks
 * to a network (docs/product.md Privacy).
 */
export default function SettingsScreen() {
  const loadSummary = useExpenseStore((state) => state.loadSummary);
  const [status, setStatus] = useState<DataStatus>({ kind: 'idle' });

  const handleExport = useCallback(async () => {
    setStatus({ kind: 'working', label: 'Preparing export…' });

    try {
      const payload = await buildExport(await getDatabase());
      const stamp = payload.exportedAt.replace(/[:.]/g, '-').slice(0, 19);
      const file = new File(Paths.cache, `expense-tracker-backup-${stamp}.json`);

      file.create({ intermediates: true, overwrite: true });
      file.write(serializeExport(payload));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export expense data',
        });
      }

      setStatus({
        kind: 'done',
        message: `Exported ${payload.expenses.length} expenses and ${payload.budgets.length} budgets.`,
      });
    } catch (error) {
      console.warn('[settings] export failed', error);
      setStatus({ kind: 'error', message: 'Could not export your data. Try again.' });
    }
  }, []);

  const handleImport = useCallback(async () => {
    setStatus({ kind: 'working', label: 'Reading backup…' });

    try {
      const picked = await File.pickFileAsync({
        mimeTypes: ['application/json', 'text/plain', 'application/octet-stream'],
      });

      if (picked.canceled) {
        setStatus({ kind: 'idle' });
        return;
      }

      const text = await picked.result.text();
      const payload = parseImport(text);
      const result = await importData(await getDatabase(), payload);

      await loadSummary();

      setStatus({ kind: 'done', message: describeImport(result) });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid backup')) {
        setStatus({ kind: 'error', message: error.message });
      } else {
        console.warn('[settings] import failed', error);
        setStatus({ kind: 'error', message: 'Could not import that file.' });
      }
    }
  }, [loadSummary]);

  const performDeleteAll = useCallback(async () => {
    setStatus({ kind: 'working', label: 'Deleting…' });

    try {
      await deleteAllData(await getDatabase());
      await loadSummary();

      setStatus({ kind: 'done', message: 'All expenses and budgets deleted.' });
    } catch (error) {
      console.warn('[settings] delete-all failed', error);
      setStatus({ kind: 'error', message: 'Could not delete your data. Try again.' });
    }
  }, [loadSummary]);

  const handleDeleteAllRequest = useCallback(() => {
    Alert.alert(
      'Delete all data?',
      'Every expense and budget on this device will be permanently removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: () => void performDeleteAll() },
      ],
    );
  }, [performDeleteAll]);

  return (
    <Screen testID="screen-settings">
      <ScreenHeader title="Settings" subtitle="Your data, your device" />

      <GlassCard title="Appearance" testID="card-appearance">
        <Text variant="body" tone="secondary" testID="settings-theme-info">
          Expense Tracker uses a single dark theme. There is no light mode to switch to.
        </Text>
      </GlassCard>

      {/*
        Budget's door. It left the bottom bar when the bar was cut back to
        Home | Add | Expenses (docs/screens.md lists "Monthly budget" among the
        Settings options), and without this row the screen would be unreachable.
        The row itself matches the Analytics link on Home, so the two "this lives
        elsewhere now" affordances in the app read as one pattern.
      */}
      <GlassCard
        title="Monthly budget"
        subtitle="Control this month's spending"
        testID="card-budget-link"
      >
        <Pressable
          testID="settings-budget"
          accessibilityRole="button"
          accessibilityLabel="Open budget"
          accessibilityHint="Set and track this month's spending limit"
          onPress={() => router.push('/budget')}
          style={styles.linkRow}
        >
          <Icon name="wallet" size={18} color={colors.accent} />
          <Text variant="body" tone="secondary" style={styles.linkLabel}>
            Set and track your monthly budget
          </Text>
          <Icon name="chevronRight" size={16} color={colors.textTertiary} />
        </Pressable>
      </GlassCard>

      <GlassCard title="Storage" testID="card-storage">
        <Text variant="body" tone="secondary" testID="settings-storage-info">
          All your data is stored locally on this device in SQLite. The app works fully offline — nothing
          is uploaded, synced, or shared.
        </Text>
      </GlassCard>

      <GlassCard title="Your data" subtitle="Back up, restore, or erase" testID="card-data">
        <View style={styles.actions}>
          <GlassButton
            variant="secondary"
            block
            onPress={handleExport}
            disabled={status.kind === 'working'}
            accessibilityLabel="Export data"
            accessibilityHint="Creates a JSON backup of your expenses and budgets"
            testID="settings-export"
          >
            <ButtonLabel variant="secondary">Export data</ButtonLabel>
          </GlassButton>

          <GlassButton
            variant="secondary"
            block
            onPress={handleImport}
            disabled={status.kind === 'working'}
            accessibilityLabel="Import or restore data"
            accessibilityHint="Restores expenses and budgets from a backup file"
            testID="settings-import"
          >
            <ButtonLabel variant="secondary">Import / restore</ButtonLabel>
          </GlassButton>

          <GlassButton
            variant="destructive"
            block
            onPress={handleDeleteAllRequest}
            disabled={status.kind === 'working'}
            accessibilityLabel="Delete all data"
            accessibilityHint="Permanently removes every expense and budget"
            testID="settings-delete-all"
          >
            <ButtonLabel variant="destructive">Delete all data</ButtonLabel>
          </GlassButton>

          {status.kind === 'working' ? (
            <Text variant="caption" tone="secondary" testID="settings-status">
              {status.label}
            </Text>
          ) : status.kind === 'done' ? (
            <Text variant="caption" tone="positive" accessibilityLiveRegion="polite" testID="settings-status">
              {status.message}
            </Text>
          ) : status.kind === 'error' ? (
            <Text variant="caption" tone="destructive" accessibilityLiveRegion="assertive" testID="settings-status">
              {status.message}
            </Text>
          ) : null}
        </View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    // A row that is a link still has to be a full-height touch target.
    minHeight: touchTarget.min,
  },
  linkLabel: {
    flex: 1,
  },
});
