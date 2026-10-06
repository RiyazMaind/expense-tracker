import type { IconName } from '@/components/ui/icon';

/**
 * The expense categories.
 *
 * The set and the order are fixed by docs/product.md, which also asks for the
 * list to stay easy to modify — so this is the single definition the entry
 * screen, the expense list and later analytics all read from. Adding a category
 * means adding one entry here and nothing else.
 *
 * `id` is what gets persisted as `expenses.category` in docs/data-model.md;
 * `label` is display copy and is free to be reworded without a migration.
 */
export type CategoryId =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'groceries'
  | 'other';

export type Category = {
  id: CategoryId;
  label: string;
  icon: IconName;
  color: string;
  badgeBg: string;
};

export const categories: readonly Category[] = [
  { id: 'food', label: 'Food', icon: 'food', color: '#F59E0B', badgeBg: 'rgba(245, 158, 11, 0.16)' },
  { id: 'transport', label: 'Transport', icon: 'transport', color: '#38BDF8', badgeBg: 'rgba(56, 189, 248, 0.16)' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping', color: '#F43F5E', badgeBg: 'rgba(244, 63, 94, 0.16)' },
  { id: 'bills', label: 'Bills', icon: 'receipt', color: '#A855F7', badgeBg: 'rgba(168, 85, 247, 0.16)' },
  { id: 'entertainment', label: 'Entertainment', icon: 'entertainment', color: '#EC4899', badgeBg: 'rgba(236, 72, 153, 0.16)' },
  { id: 'health', label: 'Health', icon: 'health', color: '#10B981', badgeBg: 'rgba(16, 185, 129, 0.16)' },
  { id: 'education', label: 'Education', icon: 'education', color: '#6366F1', badgeBg: 'rgba(99, 102, 241, 0.16)' },
  { id: 'groceries', label: 'Groceries', icon: 'groceries', color: '#84CC16', badgeBg: 'rgba(132, 204, 22, 0.16)' },
  { id: 'other', label: 'Other', icon: 'other', color: '#94A3B8', badgeBg: 'rgba(148, 163, 184, 0.16)' },
];

/**
 * Pre-selected category.
 *
 * docs/product.md sets "Adding an expense should require as few actions as
 * practical" as the guiding UX principle, and Food is the most common daily
 * entry. Preselecting it removes a tap from most entries and makes "Add expense,
 * type, save" a three-action flow.
 *
 * It is safe to preselect only because the choice is never hidden: the selected
 * chip is unmistakable, and changing it is also one tap.
 */
export const DEFAULT_CATEGORY_ID: CategoryId = 'food';

/** Look up a category by id. Falls back to `other` rather than throwing. */
export function getCategory(id: CategoryId): Category {
  return categories.find((category) => category.id === id) ?? categories[categories.length - 1];
}

/**
 * Built once at module scope — this runs on every insert, and rebuilding the set
 * per call would be the kind of allocation that adds up in a loop
 * (vercel-react-native-skills/rules/js-hoist-intl.md, same reasoning).
 */
const categoryIds: ReadonlySet<string> = new Set(categories.map((category) => category.id));

/**
 * Narrow an unvalidated string to a `CategoryId`.
 *
 * Needed because `expenses.category` is read back out of SQLite as plain text:
 * the column stores whatever string was written, and TypeScript cannot know on
 * its own that it came from this list.
 */
export function isCategoryId(id: string): id is CategoryId {
  return categoryIds.has(id);
}