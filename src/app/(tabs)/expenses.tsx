import { PlaceholderPanel } from '@/components/ui/placeholder-panel';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';

/** Expenses. Transaction list, search and filters arrive in a later phase. */
export default function ExpensesScreen() {
  return (
    <Screen testID="screen-expenses">
      <ScreenHeader title="Expenses" subtitle="Browse all transactions" />
      <PlaceholderPanel
        testID="placeholder-expenses"
        description="Your transactions will appear here."
      />
    </Screen>
  );
}
