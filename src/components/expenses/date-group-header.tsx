import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/theme';
import { formatInr } from '@/utils/currency';

/**
 * The date divider between groups of expenses, with that day's running total.
 *
 * Not a glass card. docs/design-system.md warns against creating cards simply to
 * fill space, and a divider that carries no surface keeps the rows the loudest
 * thing on the screen — the day total is context, the individual amounts are
 * what the user came to read.
 *
 * The day total is also the reason this header exists rather than a plain date
 * label: it answers "how much did I spend that day" without a trip back to
 * Analytics, which is the question a date-grouped list invites.
 */

/** Header height in points. Shared with the list's `getItemLayout`. */
export const EXPENSE_GROUP_HEADER_HEIGHT = 44;

export type DateGroupHeaderProps = {
  /** Short label: "Today", "Yesterday", "Tuesday, 6 Oct". */
  label: string;
  /** Unambiguous date for assistive tech. */
  fullLabel: string;
  /** Everything spent on this day, in paise. */
  totalPaise: number;
  /** How many expenses the day holds. */
  count: number;
  testID?: string;
};

export function DateGroupHeader({
  label,
  fullLabel,
  totalPaise,
  count,
  testID,
}: DateGroupHeaderProps) {
  const total = formatInr(totalPaise);
  const expenseWord = count === 1 ? 'expense' : 'expenses';

  return (
    <View style={styles.root} testID={testID}>
      <Text variant="label" tone="secondary" accessibilityRole="header" numberOfLines={1}>
        {label}
      </Text>

      <Text
        variant="caption"
        tone="tertiary"
        tabular
        numberOfLines={1}
        // Spoken as one statement: the visual split into a day and a total is a
        // layout decision, not two separate facts.
        accessibilityLabel={`${fullLabel}, ${count} ${expenseWord}, ${total} total`}
      >
        {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: EXPENSE_GROUP_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});