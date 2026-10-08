import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/glass/glass-card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { tint, DEFAULT_CATEGORY_ID, type CategoryId } from '@/constants/categories';
import { useCategory } from '@/store/categoryStore';
import { borders, colors, glass, radii, spacing } from '@/theme';
import type { CategorySlice } from '@/utils/analytics';
import { formatInr } from '@/utils/currency';

export type CategoryBreakdownProps = {
  slices: readonly CategorySlice[];
  /** Sum the percentages belong to. Stated in the card's spoken label. */
  totalPaise: number;
  /** Month label for the percentage wording, e.g. "October". */
  periodLabel: string;
  testID?: string;
};

/**
 * Where the money went, one row per category.
 *
 * A bar per category rather than a pie or a donut: mobile-ui-review asks that
 * categories stay distinguishable on a small screen, and comparing lengths down
 * a shared baseline is something a person can do without the legend a pie
 * requires. Every row also states the amount and the percentage in text, so the
 * chart is a second reading of the same information rather than the only place
 * it exists.
 *
 * All bars share one accent. Colour here would encode nothing — the categories
 * have icons and labels already — and glassmorphism-design rules out a rainbow
 * palette for exactly this reason.
 */
export function CategoryBreakdown({
  slices,
  totalPaise,
  periodLabel,
  testID,
}: CategoryBreakdownProps) {
  const highest = slices[0];
  const highestLabel = useCategory(highest?.category ?? DEFAULT_CATEGORY_ID).label;

  return (
    <GlassCard
      title="By category"
      /*
        The highest-spending category, stated in words. docs/product.md lists it as
        its own Analytics metric, and a sentence answers it faster than a bar
        chart can: the row below repeats the figure, so this is the summary
        rather than the only source.
      */
      subtitle={
        highest == null
          ? undefined
          : `${highestLabel} leads at ${formatInr(highest.totalPaise)} · ${highest.percent}%`
      }
      testID={testID}
      accessibilityLabel={`Spending by category for ${periodLabel}. ${formatInr(totalPaise)} across ${slices.length} ${
        slices.length === 1 ? 'category' : 'categories'
      }.`}
    >
      {slices.map((slice) => (
        <CategoryRow
          key={slice.category}
          category={slice.category}
          totalPaise={slice.totalPaise}
          entryCount={slice.entryCount}
          percent={slice.percent}
          periodLabel={periodLabel}
        />
      ))}
    </GlassCard>
  );
}

/**
 * One category: icon, name, amount, share, and a proportional bar.
 *
 * Memoised, and given primitives rather than the slice object: a memo boundary
 * compares props by identity, so handing it the same object every time is what
 * lets an unrelated re-render skip this row
 * (vercel-react-native-skills/rules/list-performance-item-memo.md,
 * list-performance-item-types.md).
 */
const CategoryRow = memo(function CategoryRow({
  category,
  totalPaise,
  entryCount,
  percent,
  periodLabel,
}: {
  category: CategoryId;
  totalPaise: number;
  entryCount: number;
  percent: number;
  periodLabel: string;
}) {
  const meta = useCategory(category);
  const amount = formatInr(totalPaise);

  const entriesLabel = entryCount === 1 ? '1 entry' : `${entryCount} entries`;

  return (
    <View
      style={styles.row}
      testID={`analytics-category-${category}`}
      accessible
      accessibilityLabel={`${meta.label}, ${amount}, ${percent}% of ${periodLabel} spending, ${entriesLabel}`}
    >
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: tint(meta.color), borderColor: meta.color + '33' }]}>
          <Icon name={meta.icon} size={18} color={meta.color} />
        </View>

        <View style={styles.copy}>
          <Text variant="body" numberOfLines={1}>
            {meta.label}
          </Text>
          <Text variant="micro" tone="tertiary" numberOfLines={1}>
            {entriesLabel}
          </Text>
        </View>

        {/*
          Tabular numerals so the amounts align in a column and can be compared
          without reading each one, matching the expense rows
          (docs/design-system.md: large amounts are the most important numbers).
        */}
        <View style={styles.amounts}>
          <Text variant="title3" tabular numberOfLines={1}>
            {amount}
          </Text>
          <View style={[styles.percentBadge, { backgroundColor: tint(meta.color) }]}>
            <Text variant="micro" tabular style={{ color: meta.color, fontWeight: '700' }}>
              {`${percent}%`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.track} importantForAccessibility="no-hide-descendants">
        <View
          style={[styles.fill, { width: `${percent}%`, backgroundColor: meta.color }]}
          testID={`analytics-category-bar-${category}`}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    // Rows are grouped, so they read as a list rather than as separate cards.
    paddingVertical: spacing.xs,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    backgroundColor: glass.subtle,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: borders.subtle,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 2,
  },
  percentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  track: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: glass.subtle,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
});