import { create } from 'zustand';

import {
  CUSTOM_CATEGORY_COLORS,
  getCategory,
  isBuiltinCategoryId,
  type Category,
  type CategoryId,
} from '@/constants/categories';
import { getDatabase } from '@/database/database';
import {
  CategoryRepository,
  type StoredCategory,
} from '@/database/repositories/category-repository';
import type { CategoryIconName } from '@/components/ui/icon';

/**
 * User-created categories, held the way the dashboard store holds its summary:
 * a cache of the last read, with SQLite as the source of truth.
 *
 * Screens — and one expense row at a time — read through `useCategory`, which
 * hands builtins back from the constant list and customs from `byId`. The map
 * entries are stable object references, so a row or chip that subscribed to one
 * category only re-renders when that exact category appears or changes; nothing
 * here is an excuse to re-render the whole history list.
 */

/** A stub for a custom id SQLite reports that this store has not seen yet. */
const FALLBACK_CATEGORY = getCategory('other');

type CategoryStore = {
  /** Only user-created categories, keyed by id. Builtins never live here. */
  byId: Record<string, Category>;
  /** User-created categories in creation order, for the picker's tail. */
  ordered: Category[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Read the `categories` table into the store. Safe to call on every focus. */
  load: () => Promise<void>;
  /** Insert a category, then add it to the store so pickers pick it up immediately. */
  create: (name: string, icon: CategoryIconName) => Promise<Category>;
};

/** The query currently in flight — same deduplication as the expense store. */
let inFlight: Promise<void> | null = null;

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  byId: {},
  ordered: [],
  status: 'idle',

  load: () => {
    if (inFlight != null) {
      return inFlight;
    }

    set({ status: 'loading' });

    const request = (async () => {
      try {
        const repository = new CategoryRepository(await getDatabase());
        const ordered = (await repository.list()).map(toCategory);

        set({
          byId: Object.fromEntries(ordered.map((category) => [category.id, category])),
          ordered,
          status: 'ready',
        });
      } catch (error) {
        // The previous set of categories stays put: a failed refresh should not
        // pretend the user's categories vanished.
        console.warn('[category-store] could not load categories', error);
        set({ status: 'error' });
      } finally {
        inFlight = null;
      }
    })();

    inFlight = request;
    return request;
  },

  create: async (name, icon) => {
    // Colour by count, rotations — stable per category, never recomputed.
    const color = CUSTOM_CATEGORY_COLORS[get().ordered.length % CUSTOM_CATEGORY_COLORS.length];

    const repository = new CategoryRepository(await getDatabase());
    const stored = await repository.insert({ name, icon, color });

    const category = toCategory(stored);

    set((state) => ({
      byId: { ...state.byId, [category.id]: category },
      ordered: [...state.ordered, category],
      status: 'ready',
    }));

    return category;
  },
}));

function toCategory(row: StoredCategory): Category {
  return {
    id: row.id,
    label: row.name,
    icon: row.icon,
    color: row.color,
  };
}

/**
 * Resolve a category id to everything the UI needs to draw it.
 *
 * Builtins come from the constant list — a stable reference, so a subscription
 * to a builtin id never re-renders. Customs come from the store, and a custom
 * id this store has not loaded yet falls back to "Other" rather than throwing,
 * matching the repositories' read-back rule.
 */
export function useCategory(id: CategoryId): Category {
  const custom = useCategoryStore((state) => state.byId[id]);

  if (isBuiltinCategoryId(id)) {
    return getCategory(id);
  }

  return custom ?? FALLBACK_CATEGORY;
}