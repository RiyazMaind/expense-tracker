import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/dashboard/stat-tile';
import { GlassCard } from '@/components/glass/glass-card';
import { ButtonLabel, GlassButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';

/**
 * Home.
 *
 * Phase 2 shell: the layout, hierarchy and surfaces are final, while the values
 * are intentionally zero until the database phase supplies real totals
 * (docs/roadmap.md, Phase 5).
 *
 * Composition answers the three questions docs/product.md requires from the
 * dashboard — today, this week, this month — with one hero figure and two
 * supporting tiles, then hands off to the empty state.
 */
export default function HomeScreen() {
  return (
    <Screen testID="screen-home">
      <ScreenHeader title="Home" subtitle="Your spending at a glance" />

      <GlassCard testID="card-today" padded={false}>
        <View style={styles.hero}>
          <Text variant="label" tone="secondary">
            Spent today
          </Text>
          <Text variant="display" tabular testID="today-total">
            ₹0
          </Text>
        </View>
      </GlassCard>

      <View style={styles.tiles}>
        <StatTile label="This week" value="₹0" testID="tile-week" />
        <StatTile label="This month" value="₹0" testID="tile-month" />
      </View>

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
