import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getCategory, type CategoryId } from '@/constants/categories';
import { borders, glass, radii, spacing } from '@/theme';
import { formatInr } from '@/utils/currency';

/**
 * One expense in the history list.
 *
 * Fixed height, and the height is exported rather than left implicit: a
 * date-grouped history is far easier to scan when every row lines up, and a known
 * row height is what lets the list answer `getItemLayout` instead of measuring.
 *
 * Primitive props only. FlatList memoises rows by comparing their props, and an
 * object prop would force a deep comparison or a re-render on every page load
 * (vercel-react-native-skills/rules/list-performance-item-memo.md,
 * list-performance-item-types.md). The row also holds no state and reads nothing
 * from a store — a list item that re-renders on unrelated app state defeats
 * virtualisation entirely.
 */

/**
 * Content height in points.
 *
 * Set on the pressable rather than on the surrounding glass surface: a
 * `GlassSurface` puts its children inside a `flexShrink: 1` view whose height is
 * auto, so a `flex: 1` child resolves against nothing and the row collapses to
 * zero height. An explicit height is the only thing that survives that wrapper.
 *
 * The surface ends up a hairline border taller than this, so the row's real
 * measured height is not exactly `EXPENSE_ROW_HEIGHT`. That is deliberate: the
 * list is not given a `getItemLayout`, because it would then be describing
 * heights that are off by the border on every row and would drift as the user
 * scrolls.
 */
export const EXPENSE_ROW_HEIGHT = 68;

export type ExpenseRowProps = {
  id: number;
  /** Whole paise, straight from the table. */
  amountMinor: number;
  category: CategoryId;
  note: string | null;
  /**
   * Stable callback owned by the list root.
   *
   * One instance for every row, with the row supplying its own id, rather than a
   * closure built per row inside `renderItem`
   * (vercel-react-native-skills/rules/list-performance-callbacks.md).
   */
  onOpen: (id: number) => void;
};

export const ExpenseRow = memo(function ExpenseRow({
  id,
  amountMinor,
  category,
  note,
  onOpen,
}: ExpenseRowProps) {
  const handlePress = useCallback(() => {
    onOpen(id);
  }, [onOpen, id]);

  const meta = getCategory(category);
  const amount = formatInr(amountMinor);

  /*
    One spoken sentence for the whole row. Left to the default, a screen reader
    would read the icon (nothing), the category, the note and the amount as four
    disconnected fragments with no indication they are one expense.
  */
  const spokenLabel =
    note == null ? `${meta.label}, ${amount}` : `${meta.label}, ${amount}, ${note}`;

  return (
    <GlassSurface
      level="subtle"
      borderLevel="subtle"
      shadow="sm"
      radius={radii.lg}
      testID={`expense-row-${id}`}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={spokenLabel}
        accessibilityHint="Opens this expense to edit or delete it"
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        <View style={[styles.badge, { backgroundColor: meta.badgeBg, borderColor: meta.color + '33' }]}>
          <Icon name={meta.icon} size={20} color={meta.color} />
        </View>

        <View style={styles.copy}>
          <Text variant="body" numberOfLines={1}>
            {meta.label}
          </Text>

          {/*
            Always mounted. A row with no note renders an empty line rather than
            collapsing, which is what keeps every row in the list the same
            height — a list that changes height depending on its content is much
            harder to scan down.
          */}
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {note ?? ''}
          </Text>
        </View>

        {/*
          Tabular numerals and a fixed width so amounts align in a column and can
          be compared without reading each one (docs/design-system.md: large
          amounts are the most important numbers on the screen).
        */}
        <Text variant="title3" tabular numberOfLines={1} style={styles.amount}>
          {amount}
        </Text>
      </Pressable>
    </GlassSurface>
  );
});

const styles = StyleSheet.create({
  pressable: {
    height: EXPENSE_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: glass.subtle,
    borderWidth: 1,
    borderColor: borders.subtle,
  },
  copy: {
    // The column takes the slack so the amount can keep its natural width.
    flex: 1,
    gap: spacing.xxs,
  },
  amount: {
    flexShrink: 0,
  },
});