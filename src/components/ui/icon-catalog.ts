/**
 * The icon catalogue, split from the `Icon` renderer on purpose.
 *
 * Node's test runner type-strips `.ts` but cannot digest JSX, and several pure
 * modules in the import graph must validate icon names without pulling in the
 * `Icon` component (`src/services/data-transfer.ts`, the category repository).
 * Everything here is data and predicates only — no `Svg` — so it stays loadable
 * by `node --test` while the glyph geometry lives beside the renderer in
 * `icon.tsx`.
 */

/**
 * Every icon the app draws. The renderer types its glyph map as
 * `Record<IconName, readonly string[]>`, so adding a name here forces an icon
 * to exist before the project typechecks.
 *
 * The UI glyphs are the app's own hand-drawn family; the trailing block is the
 * picker set offered to user-created categories.
 */
export const ICON_NAMES = [
  'home',
  'receipt',
  'chart',
  'wallet',
  'sliders',
  'plus',
  'close',
  'check',
  'trash',
  'calendar',
  'chevronLeft',
  'chevronRight',
  'food',
  'transport',
  'shopping',
  'entertainment',
  'health',
  'education',
  'groceries',
  'other',
  'search',
  'coffee',
  'gift',
  'plane',
  'paw',
  'dumbbell',
  'baby',
  'party',
  'tools',
  'flower',
  'phone',
  'banknote',
  'bed',
  'laptop',
  'fuel',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * The icons offered to user-created categories.
 *
 * The builtin category glyphs first, then the supporting set the app already
 * draws. Deliberately excludes the pure-UI glyphs (plus, close, check,
 * chevrons, sliders, trash, search, calendar, chart): a category icon should
 * mean a thing, not a control.
 */
export const CATEGORY_ICON_NAMES = [
  'food',
  'transport',
  'shopping',
  'receipt',
  'entertainment',
  'health',
  'education',
  'groceries',
  'other',
  'home',
  'wallet',
  'coffee',
  'gift',
  'plane',
  'paw',
  'dumbbell',
  'baby',
  'party',
  'tools',
  'flower',
  'phone',
  'banknote',
  'bed',
  'laptop',
  'fuel',
] as const satisfies readonly IconName[];

export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

/**
 * Plain-words search hints for the icon picker's search field.
 *
 * Keyed by icon name; a query matches when it is a case-insensitive substring
 * of the icon's own name or any of these hints, e.g. "party" or "pet". Kept
 * next to the names so adding an icon forces a decision on what people would
 * search for.
 */
const ICON_SEARCH_HINTS: Readonly<Record<CategoryIconName, string>> = {
  food: 'restaurant eat meal snack',
  transport: 'commute bus train petrol car',
  shopping: 'buy clothes store mall',
  receipt: 'bill rent utility electricity',
  entertainment: 'movie film game fun hobby',
  health: 'medical doctor medicine pharmacy',
  education: 'school study course books',
  groceries: 'grocery supermarket market vegetables',
  other: 'miscellaneous random',
  home: 'housing rent',
  wallet: 'cash money salary income wallet',
  coffee: 'cafe drinks tea chai',
  gift: 'present birthday celebrate',
  plane: 'travel flight airport trip',
  paw: 'pet pets animal vet cat dog',
  dumbbell: 'gym fitness workout exercise sport',
  baby: 'kids children toy nursery',
  party: 'celebration event festival',
  tools: 'maintenance repair workshop fix',
  flower: 'flowers garden plant',
  phone: 'mobile recharge internet call sim',
  banknote: 'loan emi cash withdraw',
  bed: 'hotel lodging stay',
  laptop: 'electronic gadget computer',
  fuel: 'petrol gas refill vehicle',
};

const ALL_ICON_NAMES: ReadonlySet<string> = new Set(ICON_NAMES);

/** Narrow an unvalidated string — e.g. a `categories.icon` row — to an `IconName`. */
export function isIconName(name: string): name is IconName {
  return ALL_ICON_NAMES.has(name);
}

/**
 * Whether `name` matches a case-insensitive query.
 *
 * Matching only on the hint words plus the icon's own name keeps the result
 * list short — "ea" pulls meals and not half the set, the way substring
 * matching against an unhinted library name would.
 */
export function categoryIconMatches(name: CategoryIconName, query: string): boolean {
  const needle = query.trim().toLowerCase();

  if (needle === '') {
    return true;
  }

  const haystack = `${name} ${ICON_SEARCH_HINTS[name]}`;
  return haystack.toLowerCase().includes(needle);
}

/**
 * Spoken name for one picker icon, so a screen-reader user hears "coffee"
 * rather than "a shape".
 */
export function categoryIconLabel(name: CategoryIconName): string {
  return ICON_SEARCH_HINTS[name].split(' ')[0] ?? 'icon';
}