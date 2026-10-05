import { PlaceholderPanel } from '@/components/ui/placeholder-panel';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';

/** Analytics. Charts and derived metrics arrive with the analytics phase. */
export default function AnalyticsScreen() {
  return (
    <Screen testID="screen-analytics">
      <ScreenHeader title="Analytics" subtitle="Understand spending patterns" />
      <PlaceholderPanel
        testID="placeholder-analytics"
        description="Spending patterns will appear here once you have expenses."
      />
    </Screen>
  );
}
