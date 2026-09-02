import type { SalesCategory } from '@/types/menu';

// The POS's built-in sale categories, at the ids the POS assigns them. Ids are
// NOT the display order (Beer=2, Wine=3, Liquor=4) — never derive an id from an
// array index; look the name up in this table.
// (Retail and Non-Taxable exist POS-side but are not surfaced in Menu Manager.)
export const DEFAULT_SALES_CATEGORIES: readonly SalesCategory[] = [
  { id: 1, name: 'Food Sales', isDefault: true },
  { id: 2, name: 'Beer Sales', isDefault: true },
  { id: 3, name: 'Wine Sales', isDefault: true },
  { id: 4, name: 'Liquor Sales', isDefault: true },
  { id: 5, name: 'Non-Alcoholic Beverages Sales', isDefault: true },
  { id: 6, name: 'Non-Food Items', isDefault: true },
  { id: 7, name: 'Cocktails', isDefault: true },
  { id: 8, name: 'Mocktails', isDefault: true },
  { id: 9, name: 'Catering Sales', isDefault: true },
] as const;

export const DEFAULT_SALE_CATEGORY = 'Food Sales';
export const DEFAULT_SALE_CATEGORY_ID = 1;

/**
 * First id available to operator-created sale categories. Ids 10–33 are
 * reserved for POS-side defaults that Menu Manager does not surface, so custom
 * ids start at 34 (matching real POS config files).
 */
export const FIRST_CUSTOM_SALE_CATEGORY_ID = 34;

/** Next free custom id — never reuses a reserved or already-taken id. */
export const nextSaleCategoryId = (existing: readonly SalesCategory[]): number =>
  Math.max(FIRST_CUSTOM_SALE_CATEGORY_ID, ...existing.map((c) => c.id + 1));

/** Seed catalog for a fresh workspace. */
export const freshSalesCategories = (): SalesCategory[] => DEFAULT_SALES_CATEGORIES.map((c) => ({ ...c }));

const norm = (name: string) => name.trim().toLowerCase();

/** Case-insensitive name lookup, so "food sales" resolves to the default row. */
export const findSaleCategoryByName = (
  catalog: readonly SalesCategory[],
  name: string,
): SalesCategory | undefined => {
  const key = norm(name);
  return key ? catalog.find((c) => norm(c.name) === key) : undefined;
};

/**
 * Resolve an item's `saleCategoryId` / `saleCategory` pair against the catalog.
 * Id wins when it resolves; otherwise the name is matched; otherwise the
 * default. Used on import and on export so the two columns never disagree.
 */
export const resolveSaleCategory = (
  catalog: readonly SalesCategory[],
  id: number | undefined,
  name: string | undefined,
): SalesCategory => {
  // A row whose name was cleared in Settings can't be exported (the POS needs a
  // non-empty saleCategory cell), so treat it as unresolved and fall through.
  const byId = id != null && id > 0 ? catalog.find((c) => c.id === id && c.name.trim()) : undefined;
  if (byId) return byId;
  const byName = name ? findSaleCategoryByName(catalog, name) : undefined;
  if (byName) return byName;
  return (
    catalog.find((c) => c.id === DEFAULT_SALE_CATEGORY_ID) ??
    catalog[0] ??
    { id: DEFAULT_SALE_CATEGORY_ID, name: DEFAULT_SALE_CATEGORY, isDefault: true }
  );
};
