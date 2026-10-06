import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { categories, type CategoryId } from '@/constants/categories';
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
 * Width is computed rather than percentage-based. Percentage widths inside a
 * wrapping row accumulate rounding error — three columns at 31.9% plus two gaps
 * overshoots the container by a fraction of a point and the last chip wraps onto
 * a row of its own. Deriving the width from the real screen width keeps the
 * three-across grid intact on a 320dp phone and on a tablet
 * (mobile-ui-review: small and large phones).
 */
export function CategoryPicker({ value, onChange, testID }: CategoryPickerProps) {
  const { width } = useWindowDimensions();

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

  const rows = chunk(categories, COLUMNS);

  return (
    <View
      style={styles.grid}
      accessibilityRole="radiogroup"
      accessibilityLabel="Category"
      testID={testID}
    >
      {rows.map((row) => (
        <View key={row[0]?.id ?? 'empty'} style={styles.row}>
          {row.map((category) => {
            const selected = category.id === value;

            return (
              <Pressable
                key={category.id}
                onPress={() => handleSelect(category.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={category.label}
                style={({ pressed }) => [
                  styles.chip,
                  { width: chipWidth },
                  selected
                    ? { backgroundColor: category.badgeBg, borderColor: category.color + '66' }
                    : styles.chipIdle,
                  pressed && styles.chipPressed,
                ]}
                testID={`category-${category.id}`}
              >
                <Icon
                  name={category.icon}
                  size={20}
                  color={selected ? category.color : colors.textTertiary}
                  strokeWidth={selected ? 2.2 : 1.8}
                />
                <Text
                  variant="caption"
                  tone={selected ? 'primary' : 'secondary'}
                  numberOfLines={1}
                  style={selected ? { color: category.color, fontWeight: '700' } : undefined}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
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
  chipIdle: {
    backgroundColor: glass.subtle,
    borderColor: borders.subtle,
  },
  chipSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  labelSelected: {
    fontWeight: '700',
  },
});