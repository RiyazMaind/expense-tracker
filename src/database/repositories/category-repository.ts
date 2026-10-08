import {
  createCustomCategoryId,
  isCustomCategoryId,
  type CustomCategoryId,
} from '@/constants/categories';
import { isIconName, type IconName } from '@/components/ui/icon-catalog';
import type { QueryableDatabase } from '@/database/queryable';

/**
 * All reads and writes of the `categories` table — the user-created categories
 * that extend the builtin set from `constants/categories.ts`.
 *
 * Same shape as the other repositories: screens never see SQL or a database
 * handle, and validation happens here so a bad write is rejected at the door
 * rather than surfacing later as a row no one can draw.
 */

/** A row as the rest of the app wants it: camelCase, and types already narrowed. */
export type StoredCategory = {
  id: CustomCategoryId;
  name: string;
  icon: IconName;
  color: string;
  createdAt: string;
};

/** What the create-category flow hands over: it has no id yet. */
export type NewCategory = {
  name: string;
  icon: IconName;
  color: string;
};

export const CATEGORY_NAME_MAX_LENGTH = 24;

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export class CategoryRepository {
  private readonly db: QueryableDatabase;

  constructor(db: QueryableDatabase) {
    this.db = db;
  }

  /** Every user-created category, creation order. */
  async list(): Promise<StoredCategory[]> {
    const rows = await this.db.getAllAsync<CategoryRow>(
      `SELECT id, name, icon, color, created_at
       FROM categories
       ORDER BY created_at ASC, id ASC`,
    );

    return rows.map(toStored);
  }

  /**
   * Insert a category and return it as stored.
   *
   * The id is generated here rather than supplied by the caller, so the UI
   * cannot produce a malformed id even by accident — `CategoryId` narrowing on
   * every expense insert downstream depends on ids being well-formed.
   */
  async insert(input: NewCategory): Promise<StoredCategory> {
    assertValidCategory(input);

    const id = createCustomCategoryId();

    // A name the user has already is a typo, not a new category — reject it
    // before it can clutter the picker with two chips that look alike.
    const duplicate = await this.db.getFirstAsync<{ existing: string }>(
      'SELECT id AS existing FROM categories WHERE lower(name) = lower(?)',
      [input.name.trim()],
    );

    if (duplicate != null) {
      throw new Error(`A category named "${input.name}" already exists`);
    }

    const timestamp = new Date().toISOString();

    await this.db.runAsync(
      'INSERT INTO categories (id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, input.name.trim(), input.icon, input.color, timestamp],
    );

    return {
      id,
      name: input.name.trim(),
      icon: input.icon,
      color: input.color,
      createdAt: timestamp,
    };
  }
}

/** The shape SQLite hands back: snake_case columns, icon and id as bare strings. */
type CategoryRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
};

function toStored(row: CategoryRow): StoredCategory {
  // The table is only ever written by `insert`, which narrows both, so a row
  // that slipped past (a future version, a manual edit) falls to safe defaults
  // rather than failing the whole list query.
  return {
    id: isCustomCategoryId(row.id) ? row.id : createCustomCategoryId(),
    name: row.name,
    icon: isIconName(row.icon) ? row.icon : 'other',
    color: COLOR_PATTERN.test(row.color) ? row.color : '#94A3B8',
    createdAt: row.created_at,
  };
}

function assertValidCategory(input: NewCategory): void {
  const name = input.name.trim();

  if (name === '') {
    throw new Error('Category name must not be empty');
  }

  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new Error(`Category name must be at most ${CATEGORY_NAME_MAX_LENGTH} characters`);
  }

  if (!isIconName(input.icon)) {
    throw new Error(`Unknown category icon: ${input.icon}`);
  }

  if (!COLOR_PATTERN.test(input.color)) {
    throw new Error(`Category color must be a hex colour, received ${input.color}`);
  }
}