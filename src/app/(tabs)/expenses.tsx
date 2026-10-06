import { router, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { DateGroupHeader } from '@/components/expenses/date-group-header';
import { ExpenseRow } from '@/components/expenses/expense-row';
import { ButtonLabel, GlassButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SettingsIconButton } from '@/components/ui/settings-icon-button';
import { Text } from '@/components/ui/text';
import { getDatabase } from '@/database/database';
import {
  EXPENSE_PAGE_SIZE,
  ExpenseRepository,
  type Expense,
} from '@/database/repositories/expense-repository';
import { colors, spacing } from '@/theme';
import { groupExpensesByDate, type ExpenseGroupItem } from '@/utils/expense-groups';

/**
 * Expenses — the expense history.
 *
 * docs/screens.md: "Purpose: browse all transactions", grouped by date with a
 * category indicator, the amount, and a way to reach edit and delete.
 *
 * Rows come from SQLite on every focus, and the loaded rows live in this
 * screen's own state. They are deliberately not in the store: the store exists to
 * hold the summary that Home needs instantly on the way back, whereas these rows
 * are scoped to one screen and are re-read whenever it comes forward. Mirroring
 * the whole table into a global store would mean re-rendering this list on every
 * unrelated write (vercel-react-native-skills/rules/rerender-dependencies.md).
 */

/**
 * Whether the last load worked.
 *
 * One value rather than a boolean next to an error flag, because "still waiting"
 * and "went wrong" are different states with different screens. `status` says
 * whether the *read* succeeded; whether there is anything to show is a separate
 * question answered by `rows.length`, which is why the spinner is gated on both —
 * a failed page load while rows are already on screen must not replace them.
 */
type ListStatus = 'loading' | 'ready' | 'error';

export default function ExpensesScreen() {
  // Destructured for React Compiler stability.
  const { push } = useRouter();

  const [rows, setRows] = useState<Expense[]>([]);
  const [status, setStatus] = useState<ListStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  /*
    Today's date, held as state rather than read during render.

    Group labels ("Today", "Yesterday") are relative to it, so it is refreshed
    whenever the data is refreshed — which also means a list left open across
    midnight is relabelled correctly the next time it comes forward, instead of
    showing yesterday's expenses under "Today". Reading `new Date()` in the
    render body instead would return a new object every pass and rebuild the
    whole grouping each time.
  */
  const [today, setToday] = useState(() => new Date());

  /*
    Guards against overlapping page loads. `onEndReached` fires whenever the last
    rows are on screen and will fire again the moment new content shortens the
    content, so two fast passes would both read the same offset and append the
    same page twice. A ref rather than a state flag: it is read and written inside
    an async callback that must not re-run merely because the guard changed.
  */
  const loadingMore = useRef(false);

  const items = useMemo(() => groupExpensesByDate(rows, today), [rows, today]);

  const loadFirstPage = useCallback(async () => {
    loadingMore.current = true;

    try {
      const repository = new ExpenseRepository(await getDatabase());
      const page = await repository.listRecent({ limit: EXPENSE_PAGE_SIZE, offset: 0 });

      setRows(page.expenses);
      setHasMore(page.hasMore);
      setStatus('ready');
    } catch (error) {
      // Rows already on screen are left alone; only a first load with nothing to
      // show replaces them with an error.
      console.warn('[expenses] could not load the first page', error);

      if (rows.length === 0) {
        setStatus('error');
      }
    }

    /*
      Released after the try/catch rather than in a `finally` clause. Control
      reaches here on both paths, so it is the same thing — but this project's
      Babel React Compiler cannot lower a `finally` at all and fails the bundle
      with "Handle TryStatement with a finalizer ('finally') clause". Nothing
      local catches that: typecheck, lint and the Node suite all pass on code
      that will not build.
    */
    loadingMore.current = false;
  }, [rows.length]);

  const loadNextPage = useCallback(async () => {
    // Two guards, and both matter: `hasMore` says there is nothing more to
    // fetch, and the ref stops the duplicate call that `onEndReached` makes while
    // the first is still open.
    if (loadingMore.current || !hasMore) {
      return;
    }

    loadingMore.current = true;

    try {
      const repository = new ExpenseRepository(await getDatabase());
      const page = await repository.listRecent({
        limit: EXPENSE_PAGE_SIZE,
        // Read against the rows on screen, not against a separate counter that
        // could drift from them.
        offset: rows.length,
      });

      setHasMore(page.hasMore);

      if (page.expenses.length > 0) {
        // Append. These are the same row objects the query returned, so the
        // rows already on screen keep their identity and do not re-render.
        setRows((current) => [...current, ...page.expenses]);
      }
    } catch (error) {
      /*
        Stop paging rather than looping. A failure here leaves the offset where it
        was, so the next scroll would ask for the same page again and keep
        failing; clearing `hasMore` turns the footer into "End of history" and
        leaves a working part of the list rather than an endless spinner.
      */
      console.warn('[expenses] could not load the next page', error);
      setHasMore(false);
    }

    // Released outside the try/catch — see `loadFirstPage`.
    loadingMore.current = false;
  }, [hasMore, rows.length]);

  /*
    Focus, not mount. Returning from add-expense or from editing an expense has to
    show the new row without the user pulling to refresh, which is also what keeps
    the screen honest after a delete. This is the screen's equivalent of Home's
    `useFocusEffect` summary reload.
  */
  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
      loadFirstPage();
    }, [loadFirstPage]),
  );

  const handleOpen = useCallback(
    (id: number) => {
      push({ pathname: '/expense-detail', params: { id: String(id) } });
    },
    [push],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setToday(new Date());
    await loadFirstPage();
    setRefreshing(false);
  }, [loadFirstPage]);

  const handleAdd = useCallback(() => {
    router.push('/add-expense');
  }, []);

  const handleRetry = useCallback(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  /*
    One callback for every row, with each row passing its own id. A closure built
    per row inside `renderItem` would hand every row a new function identity and
    defeat both `React.memo` on the row and FlatList's own change detection
    (vercel-react-native-skills/rules/list-performance-callbacks.md).
  */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ExpenseGroupItem>) => {
      if (item.kind === 'header') {
        return (
          <DateGroupHeader
            label={item.label}
            fullLabel={item.fullLabel}
            totalPaise={item.totalPaise}
            count={item.count}
            testID={`date-group-${item.dateKey}`}
          />
        );
      }

      return (
        <ExpenseRow
          id={item.expense.id}
          amountMinor={item.expense.amountMinor}
          category={item.expense.category}
          note={item.expense.note}
          onOpen={handleOpen}
        />
      );
    },
    [handleOpen],
  );

  /*
    One key per item, namespaced by kind.

    This is what keeps a mixed list of headers and rows correct in RN 0.86. There
    used to be a separate `getItemType` prop for telling the list that a list
    holds more than one kind of cell; it no longer exists — every cell is now keyed
    by its own `keyExtractor` result, so two items with different keys can never
    share a cell, and a header cannot be recycled as an expense. The namespacing
    matters for that guarantee to hold on its own terms, so a date of
    `expense:12` could never collide with a row whose id is 12.
  */
  const keyExtractor = useCallback((item: ExpenseGroupItem) => item.key, []);

  const showInitialLoading = status === 'loading' && rows.length === 0;

  return (
    <Screen scroll={false} testID="screen-expenses">
      <ScreenHeader
        title="Expenses"
        subtitle="Every transaction you've logged"
        /*
          The same always-present primary action Home carries. The empty state
          below is the other entry point to it, but that unmounts on the first
          expense, which would leave no way to add the second one from this screen.
        */
        action={<SettingsIconButton testID="expenses-settings" />}
      />

      {/*
        No `getItemLayout`, deliberately.

        It is the usual FlatList optimisation when row heights are known up front,
        and this list has a constant for exactly that reason — but the rows are
        glass surfaces, and a surface's border sits outside the height its content
        declares. Measured on device, rendered rows came out taller than the
        constant being reported, so every declared offset drifted further from
        reality the further the user scrolled. FlatList measures the real height
        itself and caches it per cell, which is correct by construction; the
        constant now only decides that rows are uniform, which is what makes the
        list scannable.

        Likewise no `getItemType`: RN 0.86 keys every cell by `keyExtractor`, so
        a header can no longer be recycled as an expense. `keyExtractor` is what
        keeps the two kinds apart.
      */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={loadNextPage}
        // Fire before the last row is flush with the bottom, so the next page is
        // usually already there by the time the user reaches it.
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        // A tap on a row must still register while the keypad is up from a
        // previous screen, rather than only dismissing it.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textTertiary}
            colors={[colors.accent]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListEmptyComponent={
          showInitialLoading ? (
            <View style={styles.centered} testID="expenses-loading">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : status === 'error' ? (
            <EmptyState
              testID="expenses-error"
              title="Could not load your expenses"
              body="Your data is still on this device. Pull down to try reading it again."
              action={
                <GlassButton
                  accessibilityLabel="Retry loading expenses"
                  accessibilityHint="Reads the expense list again"
                  onPress={handleRetry}
                  testID="expenses-retry"
                >
                  <ButtonLabel>Try again</ButtonLabel>
                </GlassButton>
              }
            />
          ) : (
            <EmptyState
              testID="empty-expenses"
              title="No expenses yet"
              body="Add your first expense and it will appear here, grouped by day."
              action={
                <GlassButton
                  accessibilityLabel="Add expense"
                  accessibilityHint="Opens the add expense screen"
                  onPress={handleAdd}
                  testID="empty-expenses-add"
                >
                  <ButtonLabel>Add expense</ButtonLabel>
                </GlassButton>
              }
            />
          )
        }
        ListFooterComponent={
          /*
            Only for a list that has content. An empty list has the empty state
            above instead, and "End of history" under it would read as though the
            list had failed to load.
          */
          rows.length > 0 ? (
            <View style={styles.footer} testID="expenses-footer">
              {hasMore ? (
                <ActivityIndicator color={colors.textTertiary} />
              ) : (
                <Text variant="caption" tone="tertiary" center>
                  {`${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'}`}
                </Text>
              )}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  centered: {
    paddingTop: spacing.xxl,
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
});