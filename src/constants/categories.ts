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
};

export const categories: readonly Category[] = [
  { id: 'food', label: 'Food', icon: 'food' },
  { id: 'transport', label: 'Transport', icon: 'transport' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping' },
  { id: 'bills', label: 'Bills', icon: 'receipt' },
  { id: 'entertainment', label: 'Entertainment', icon: 'entertainment' },
  { id: 'health', label: 'Health', icon: 'health' },
  { id: 'education', label: 'Education', icon: 'education' },
  { id: 'groceries', label: 'Groceries', icon: 'groceries' },
  { id: 'other', label: 'Other', icon: 'other' },
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