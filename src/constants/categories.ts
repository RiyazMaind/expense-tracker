import type { IconName } from '@/components/ui/icon';

/**
 * The expense categories.
 *
 * Two kinds share the type: the nine builtins fixed by docs/product.md, and
 * user-created categories whose ids are namespaced `custom:<id>` and live in
 * SQLite's `categories` table (see `docs/data-model.md`). Everything that reads
 * `expenses.category` narrows through `isCategoryId`, which accepts both, so a
 * user-created category flows through insert, list, analytics and backup
 * exactly like a builtin.
 *
 * `id` is what gets persisted as `expenses.category`; `label` is display copy
 * and is free to be reworded without a migration.
 */
export type BuiltinCategoryId =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'groceries'
  | 'other';

/**
 * Namespace for user-created category ids.
 *
 * A prefix rather than a bare UUID: `isCategoryId` has to tell "a category the
 * app may show" from "a typo in the column" synchronously — on read-back, on
 * import validation — and a prefix is checkable without touching the database.
 * The part after the prefix only ever has to be unique, so it is generated
 * locally and needs no lookup.
 */
const CUSTOM_CATEGORY_PREFIX = 'custom:';

/** The generated portion is base36: lowercase letters and digits, short enough to read in a query log. */
const CUSTOM_ID_PATTERN = /^[a-z0-9]{4,64}$/;

export type CustomCategoryId = `${typeof CUSTOM_CATEGORY_PREFIX}${string}`;

export type CategoryId = BuiltinCategoryId | CustomCategoryId;

/**
 * Everything the UI needs to draw one category chip, badge or bar.
 *
 * `color` is the single source of the category's identity: the translucent
 * badge/track tint is derived from it with `tint()` rather than stored, so a
 * category can never end up with a tint that disagrees with its own colour.
 */
export type Category = {
  id: CategoryId;
  label: string;
  icon: IconName;
  color: string;
};

export const categories: readonly Category[] = [
  { id: 'food', label: 'Food', icon: 'food', color: '#F59E0B' },
  { id: 'transport', label: 'Transport', icon: 'transport', color: '#38BDF8' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping', color: '#F43F5E' },
  { id: 'bills', label: 'Bills', icon: 'receipt', color: '#A855F7' },
  { id: 'entertainment', label: 'Entertainment', icon: 'entertainment', color: '#EC4899' },
  { id: 'health', label: 'Health', icon: 'health', color: '#10B981' },
  { id: 'education', label: 'Education', icon: 'education', color: '#6366F1' },
  { id: 'groceries', label: 'Groceries', icon: 'groceries', color: '#84CC16' },
  { id: 'other', label: 'Other', icon: 'other', color: '#94A3B8' },
];

/**
 * Colours handed to newly created categories, in rotation.
 *
 * Assigned once at creation and stored, never recomputed: re-deriving from the
 * list size would recolour yesterday's categories the moment one was deleted.
 * Eight hues that read clearly against the dark glass and are not already
 * owned by a builtin, so a custom chip is never mistaken for a builtin chip
 * at a glance.
 */
export const CUSTOM_CATEGORY_COLORS: readonly string[] = [
  '#F97316', // orange
  '#22D3EE', // cyan
  '#A78BFA', // violet
  '#F472B6', // light rose
  '#FACC15', // yellow
  '#2DD4BF', // teal
  '#FB7185', // coral
  '#60A5FA', // blue
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
export const DEFAULT_CATEGORY_ID: BuiltinCategoryId = 'food';

/**
 * The translucent chip/badge colour, as an 8-digit hex of the category colour.
 *
 * `0x29` is 41/255 = 16.1% — the alpha the builtin badge backgrounds used when
 * they were hand-written `rgba(...)` strings. Deriving keeps tint and colour
 * from ever drifting apart.
 */
export function tint(color: string): string {
  return `${color}29`;
}

/** Look up a builtin category by id. Falls back to `other` rather than throwing. */
export function getCategory(id: CategoryId): Category {
  return (
    categories.find((category) => category.id === id) ?? categories[categories.length - 1]
  );
}

/**
 * Built once at module scope — this runs on every insert, and rebuilding the set
 * per call would be the kind of allocation that adds up in a loop
 * (vercel-react-native-skills/rules/js-hoist-intl.md, same reasoning).
 */
const builtinCategoryIds: ReadonlySet<string> = new Set(
  categories.map((category) => category.id),
);

/** `true` for one of the nine categories shipped with the app. */
export function isBuiltinCategoryId(id: string): id is BuiltinCategoryId {
  return builtinCategoryIds.has(id);
}

/**
 * `true` for a well-formed user-created category id.
 *
 * Format-checked rather than looked up: import validates files before any row
 * is written, and a database row is still worth rendering even if its
 * `categories` definition went missing (the UI falls back to "Other").
 */
export function isCustomCategoryId(id: string): id is CustomCategoryId {
  if (!id.startsWith(CUSTOM_CATEGORY_PREFIX)) {
    return false;
  }

  return CUSTOM_ID_PATTERN.test(id.slice(CUSTOM_CATEGORY_PREFIX.length));
}

/**
 * Narrow an unvalidated string to a `CategoryId`.
 *
 * Needed because `expenses.category` is read back out of SQLite as plain text:
 * the column stores whatever string was written, and TypeScript cannot know on
 * its own that it came from this list. Both kinds of id pass — a user-created
 * category is as valid as a builtin — and anything else is rejected so callers
 * can fall back to `other`.
 */
export function isCategoryId(id: string): id is CategoryId {
  return isBuiltinCategoryId(id) || isCustomCategoryId(id);
}

/**
 * Fresh id for a category the user is creating.
 *
 * Time base36 for rough creation ordering, plus randomness so two categories
 * created in the same millisecond cannot collide. No lookup required — the
 * probability of collision across a personal expense tracker's lifetime is
 * negligible, and the table's primary key is the backstop.
 */
export function createCustomCategoryId(): CustomCategoryId {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);

  return `${CUSTOM_CATEGORY_PREFIX}${time}${random}`;
}
