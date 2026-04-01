import type {
  ExcelMenuData,
  Menu,
  Category,
  Item,
  CategoryItem,
} from '@/types/menu';
import type { ScraperMenuData } from './doordashApi';

// ---------------------------------------------------------------------------
// Coerce helpers — handle null/undefined/wrong-type values from API
// ---------------------------------------------------------------------------

const str = (v: unknown): string => (v == null ? '' : String(v));

const num = (v: unknown): number => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const bool = (v: unknown, defaultValue = false): boolean => {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || v === 'true') return true;
  if (v === 0 || v === '0' || v === 'false') return false;
  return defaultValue;
};

// ---------------------------------------------------------------------------
// Public summary type — shown to user before confirming import
// ---------------------------------------------------------------------------

export interface ScraperImportSummary {
  storeName: string;
  categoryCount: number;
  itemCount: number;
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

/**
 * Convert the scrapers JSON output (mapper.py → /api/scrape-json) into the
 * ExcelMenuData shape consumed by menuStore.importData().
 *
 * All fields are coerced / defaulted so the result is always valid even when
 * the scraper produces null or missing values.
 */
export function mapScraperToExcelData(data: ScraperMenuData): ExcelMenuData {
  // --- Menus ---
  const menus: Menu[] = (data.Menu ?? []).map((m) => ({
    id: num(m.id),
    menuName: str(m.menuName) || 'DoorDash Import',
    posDisplayName: str(m.posDisplayName) || str(m.menuName) || 'DoorDash Import',
    posButtonColor: str(m.posButtonColor) || '#f97316',
    picture: str(m.picture),
    sortOrder: num(m.sortOrder) || 1,
  }));

  // --- Categories ---
  const categories: Category[] = (data.Category ?? []).map((c) => ({
    id: num(c.id),
    categoryName: str(c.categoryName),
    posDisplayName: str(c.posDisplayName) || str(c.categoryName),
    kdsDisplayName: str(c.kdsDisplayName) || str(c.categoryName),
    color: str(c.color),
    image: str(c.image),
    kioskImage: str(c.kioskImage),
    parentCategoryId: c.parentCategoryId != null ? num(c.parentCategoryId) : null,
    tagIds: str(c.tagIds),
    menuIds: str(c.menuIds),
    sortOrder: num(c.sortOrder),
  }));

  // --- Items ---
  const items: Item[] = (data.Item ?? []).map((i) => ({
    id: num(i.id),
    itemName: str(i.itemName),
    posDisplayName: str(i.posDisplayName) || str(i.itemName),
    kdsName: str(i.kdsName) || str(i.itemName),
    itemDescription: str(i.itemDescription),
    itemPicture: str(i.itemPicture),
    onlineImage: str(i.onlineImage),
    landscapeImage: str(i.landscapeImage),
    thirdPartyImage: str(i.thirdPartyImage),
    kioskItemImage: str(i.kioskItemImage),
    itemPrice: num(i.itemPrice),
    taxLinkedWithParentSetting: bool(i.taxLinkedWithParentSetting, true),
    calculatePricesWithTaxIncluded: bool(i.calculatePricesWithTaxIncluded, false),
    takeoutException: bool(i.takeoutException, false),
    stockStatus: str(i.stockStatus) || 'inStock',
    stockValue: num(i.stockValue),
    orderQuantityLimit: bool(i.orderQuantityLimit, true),
    minLimit: num(i.minLimit) || 1,
    maxLimit: num(i.maxLimit) || 999,
    noMaxLimit: bool(i.noMaxLimit, false),
    stationIds: str(i.stationIds),
    preparationTime: num(i.preparationTime),
    calories: num(i.calories),
    tagIds: str(i.tagIds),
    inheritTagsFromCategory: bool(i.inheritTagsFromCategory, false),
    saleCategory: str(i.saleCategory) || 'Food Sales',
    allergenIds: str(i.allergenIds),
    inheritModifiersFromCategory: bool(i.inheritModifiersFromCategory, false),
    addonIds: str(i.addonIds),
    isSpecialRequest: bool(i.isSpecialRequest, true),
    visibilityPos: bool(i.visibilityPos, true),
    visibilityKiosk: bool(i.visibilityKiosk, true),
    visibilityOnline: bool(i.visibilityOnline, true),
    visibilityThirdParty: bool(i.visibilityThirdParty, true),
    availableDays: str(i.availableDays),
    availableTimeStart: str(i.availableTimeStart),
    availableTimeEnd: str(i.availableTimeEnd),
  }));

  // --- Category Items ---
  const categoryItems: CategoryItem[] = (data['Category Items'] ?? []).map((ci) => ({
    id: num(ci.id),
    categoryId: num(ci.categoryId),
    itemId: num(ci.itemId),
    sortOrder: num(ci.sortOrder),
  }));

  return {
    menus,
    categories,
    items,
    itemModifiers: [],
    categoryModifierGroups: [],
    categoryModifiers: [],
    categoryItems,
    itemModifierGroups: [],
    modifierGroups: [],
    modifiers: [],
    modifierOptions: [],
    modifierModifierOptions: [],
    allergens: [],
    tags: [],
  };
}

/**
 * Build a human-readable summary from the scraper response for the import
 * confirmation preview.
 */
export function buildImportSummary(data: ScraperMenuData): ScraperImportSummary {
  const menu = data.Menu?.[0];
  return {
    storeName: str(menu?.menuName) || 'DoorDash Store',
    categoryCount: (data.Category ?? []).length,
    itemCount: (data.Item ?? []).length,
  };
}

/**
 * Parse a JSON file upload and return the scraper payload.
 * Accepts either the /api/scrape-json response OR the raw scrape_store() output.
 */
export async function parseJsonFile(file: File): Promise<ScraperMenuData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('File does not contain a valid JSON object.');
        }
        resolve(parsed as ScraperMenuData);
      } catch (err) {
        reject(new Error(`Invalid JSON file: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}
