import { PlaceholderPanel } from '@/components/ui/placeholder-panel';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';

/** Settings. Currency, appearance, export and import arrive later. */
export default function SettingsScreen() {
  return (
    <Screen testID="screen-settings">
      <ScreenHeader title="Settings" subtitle="Configure your tracker" />
      <PlaceholderPanel
        testID="placeholder-settings"
        description="Currency, appearance and data backup options will appear here."
      />
    </Screen>
  );
}
