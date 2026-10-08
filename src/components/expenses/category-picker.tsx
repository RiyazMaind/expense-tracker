import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { NewCategorySheet } from '@/components/expenses/new-category-sheet';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  categories,
  tint,
  type Category,
  type CategoryId,
} from '@/constants/categories';
import { useCategoryStore } from '@/store/categoryStore';
import { borders, colors, glass, radii, spacing } from '@/theme';

/** Chips per row. Three fits the longest label, "Entertainment", without wrapping. */
const COLUMNS = 3;

export type CategoryPickerProps = {
  value: CategoryId;
  onChange: (next: CategoryId) => void;
  testID?: string;
};

/**
 * The category selector.
 *
 * Rendered as a radio group rather than a list of switches: exactly one
 * category applies to an expense, and `radiogroup`/`radio` with a checked state
 * is what tells a screen-reader user that, instead of leaving them to infer
 * "one of these is active" from colour.
 *
 * The grid is the nine builtins followed by the user-created categories, in
 * creation order, with a "New category" cell at the very end. Creating a
 * category opens a sheet that returns the finished category, which lands in
 * the store and is selected immediately — the picker never invents a row.
 *
 * Width is computed rather than percentage-based. Percentage widths inside a
 * wrapping row accumulate rounding error — three columns at 31.9% plus two gaps
 * overshoots the container by a fraction of a point and the last chip wraps onto
 * a row of its own. Deriving the width from the real screen width keeps the
 * three-across grid intact on a 320dp phone and on a tablet
 * (mobile-ui-review: small and large phones).
 */
export function CategoryPicker({ value, onChange, testID }: CategoryPickerProps) {
  const { width } = useWindowDimensions();
  const customCategories = useCategoryStore((state) => state.ordered);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Matches `Screen`'s horizontal padding on both sides, plus the row gaps.
  const chipWidth =
    (width - spacing.lg * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS;

  const handleSelect = (id: CategoryId) => {
    if (id === value) {
      return;
    }

    // A selection tick rather than an impact: this is a segmented choice being
    // moved, not an action being committed.
    Haptics.selectionAsync().catch(() => {
      // Haptics are unavailable on web and some devices. Never block the tap.
    });

    onChange(id);
  };

  const handleCreated = (category: Category) => {
    setSheetOpen(false);
    onChange(category.id);
  };

  const cells: readonly (Category | { kind: 'new' })[] = [
    ...categories,
    ...customCategories,
    { kind: 'new' },
  ];
  const rows = chunk(cells, COLUMNS);

  return (
    <View
      style={styles.grid}
      accessibilityRole="radiogroup"
      accessibilityLabel="Category"
      testID={testID}
    >
      {rows.map((row) => (
            <View
              key={
                row[0] == null
                  ? 'empty-row'
                  : 'kind' in row[0]
                    ? 'new-row'
                    : row[0].id
              }
              style={styles.row}
            >
              {row.map((cell) => {
                if ('kind' in cell) {
              return (
                <Pressable
                  key="new"
                  onPress={() => setSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new category"
                  accessibilityHint="Opens a form to name the category and pick its icon"
                  style={({ pressed }) => [
                    styles.chip,
                    styles.newChip,
                    { width: chipWidth },
                    pressed && styles.chipPressed,
                  ]}
                  testID="category-new"
                >
                  <Icon name="plus" size={20} color={colors.textSecondary} />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    New category
                  </Text>
                </Pressable>
              );
            }

            const selected = cell.id === value;

            return (
              <Pressable
                key={cell.id}
                onPress={() => handleSelect(cell.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={cell.label}
                style={({ pressed }) => [
                  styles.chip,
                  { width: chipWidth },
                  selected
                    ? { backgroundColor: tint(cell.color), borderColor: cell.color + '66' }
                    : styles.chipIdle,
                  pressed && styles.chipPressed,
                ]}
                testID={`category-${cell.id}`}
              >
                <Icon
                  name={cell.icon}
                  size={20}
                  color={selected ? cell.color : colors.textTertiary}
                  strokeWidth={selected ? 2.2 : 1.8}
                />
                <Text
                  variant="caption"
                  tone={selected ? 'primary' : 'secondary'}
                  numberOfLines={1}
                  style={selected ? { color: cell.color, fontWeight: '700' } : undefined}
                >
                  {cell.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <NewCategorySheet
        /*
          Remount on open: the Modal stays mounted to fade out on close, and a
          remount is the one way to be sure a reopen starts from a blank form
          and an enabled button — not with a previous category's typed name or
          a still-set `creating` flag.
        */
        key={sheetOpen ? 'open' : 'closed'}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </View>
  );
}

/** Split a list into fixed-size rows. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size) as T[]);
  }

  return rows;
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    // Tall enough to clear the 44pt touch floor with room for the icon and the
    // label beneath it.
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  newChip: {
    backgroundColor: glass.subtle,
    borderColor: borders.subtle,
    borderStyle: 'dashed',
    opacity: 0.9,
  },
  chipIdle: {
    backgroundColor: glass.subtle,
    borderColor: borders.subtle,
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});