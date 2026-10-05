import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/dashboard/stat-tile';
import { GlassCard } from '@/components/glass/glass-card';
import { ButtonIcon, ButtonLabel, GlassButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useExpenseStore } from '@/store/expenseStore';
import { colors, spacing } from '@/theme';
import { formatInr } from '@/utils/currency';

/**
 * Home.
 *
 * Composition answers the three questions docs/product.md requires from the
 * dashboard — today, this week, this month — with one hero figure and two
 * supporting tiles, then hands off to the empty state.
 *
 * The figures come from SQLite via the store. The store holds the last summary it
 * read so this screen renders real numbers immediately on the way back from the
 * entry screen, but it is a cache, not the source of truth: `useFocusEffect`
 * re-reads the aggregate every time the screen comes forward, which is also what
 * makes the totals correct across a midnight rollover without a timer.
 */
export default function HomeScreen() {
  const summary = useExpenseStore((state) => state.summary);
  const loadSummary = useExpenseStore((state) => state.loadSummary);

  /*
    Focus, not mount. This screen stays mounted while the user is in
    add-expense, so a one-shot load on mount would leave the totals describing
    the moment the app opened rather than the moment they looked.
  */
  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  const hasExpenses = (summary?.expenseCount ?? 0) > 0;

  return (
    <Screen testID="screen-home">
      <ScreenHeader
        title="Home"
        subtitle="Your spending at a glance"
        /*
          The app's primary action, so it cannot live only inside the empty
          state: that unmounts on the first expense and would strand the user
          with no way to record a second one. Solid rather than glass because
          docs/design-system.md requires the Add Expense action to stay
          immediately recognizable.
        */
        action={
          <GlassButton
            accessibilityLabel="Add expense"
            accessibilityHint="Opens the add expense screen"
            onPress={() => router.push('/add-expense')}
            size="sm"
            variant="primary"
            testID="home-add"
          >
            <ButtonIcon>
              <Icon name="plus" size={18} color={colors.textOnAccent} />
            </ButtonIcon>
            <ButtonLabel>Add</ButtonLabel>
          </GlassButton>
        }
      />

      <GlassCard testID="card-today" padded={false}>
        <View style={styles.hero}>
          <Text variant="label" tone="secondary">
            Spent today
          </Text>
          <Text variant="display" tabular testID="today-total">
            {formatInr(summary?.todayPaise ?? 0)}
          </Text>
        </View>
      </GlassCard>

      <View style={styles.tiles}>
        <StatTile
          label="This week"
          value={formatInr(summary?.weekPaise ?? 0)}
          testID="tile-week"
        />
        <StatTile
          label="This month"
          value={formatInr(summary?.monthPaise ?? 0)}
          testID="tile-month"
        />
      </View>

      {/*
        Driven by the all-time count rather than by today's figure: someone who
        logged an expense last month should not be told they have none. While the
        first read is in flight there is nothing to assert either way, and this
        shows the empty state — whose CTA restates the header action for a
        first-run user who has not noticed it yet.
      */}
      {!hasExpenses ? (
        <EmptyState
          testID="empty-home"
          title="No expenses yet"
          body="Start tracking your spending by adding your first expense."
          action={
            <GlassButton
              accessibilityLabel="Add expense"
              accessibilityHint="Opens the add expense screen"
              onPress={() => router.push('/add-expense')}
              testID="empty-home-add"
            >
              <ButtonLabel>Add expense</ButtonLabel>
            </GlassButton>
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
