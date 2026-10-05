import { PlaceholderPanel } from '@/components/ui/placeholder-panel';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';

/** Budget. Monthly limit and progress arrive with the budget phase. */
export default function BudgetScreen() {
  return (
    <Screen testID="screen-budget">
      <ScreenHeader title="Budget" subtitle="Control monthly spending" />
      <PlaceholderPanel
        testID="placeholder-budget"
        description="Your monthly budget and progress will appear here."
      />
    </Screen>
  );
}
