import * as XLSX from 'xlsx';
import type {
  ExcelMenuData,
  Menu,
  Category,
  Item,
  Modifier,
  ModifierOption,
  ModifierModifierOption,
  Allergen,
  Tag,
  Setting,
} from '@/types/menu';
import { serializeVisibility } from '@/lib/visibility';

// Sheet names — must match the POS import schema exactly (order included).
const SHEET_NAMES = {
  MENU: 'Menu',
  CATEGORY: 'Category',
  ITEM: 'Item',
  ITEM_MODIFIERS: 'Item Modifiers',
  CATEGORY_MODIFIER_GROUPS: 'Category ModifierGroups',
  CATEGORY_MODIFIERS: 'Category Modifiers',
  CATEGORY_ITEMS: 'Category Items',
  ITEM_MODIFIER_GROUP: 'Item Modifier Group',
  MODIFIER_GROUP: 'Modifier Group',
  MODIFIER: 'Modifier',
  MODIFIER_OPTION: 'Modifier Option',
  MODIFIER_MODIFIER_OPTIONS: 'Modifier ModifierOptions',
  ALLERGEN: 'Allergen',
  TAG: 'Tag',
  SETTING: 'Setting',
};

// Column headers for each sheet — must match the POS import schema exactly
// (names AND order). Derived from real POS export files (business-1289 / 1585 / 596).
const HEADERS = {
  MENU: ['id', 'menuName', 'posDisplayName', 'posButtonColor', 'picture', 'sortOrder', 'settingId', 'visibility'],
  CATEGORY: ['id', 'categoryName', 'posDisplayName', 'kdsDisplayName', 'color', 'image', 'kioskImage', 'parentCategoryId', 'tagIds', 'menuIds', 'sortOrder', 'settingId', 'visibility'],
  ITEM: [
    'id', 'itemName', 'posDisplayName', 'kdsName', 'itemDescription', 'itemPicture',
    'onlineImage', 'landscapeImage', 'thirdPartyImage', 'kioskItemImage', 'itemPrice',
    'taxLinkedWithParentSetting', 'calculatePricesWithTaxIncluded', 'takeoutException',
    'stockStatus', 'stockValue', 'orderQuantityLimit', 'minLimit', 'maxLimit', 'noMaxLimit',
    'stationIds', 'preparationTime', 'calories', 'tagIds', 'inheritTagsFromCategory',
    'saleCategory', 'allergenIds', 'inheritModifiersFromCategory', 'addonIds', 'isSpecialRequest',
    'doordashPrice', 'uberEatsPrice', 'grubHubPrice', 'settingId', 'visibility',
  ],
  ITEM_MODIFIERS: ['itemId', 'modifierId', 'sortOrder'],
  CATEGORY_MODIFIER_GROUPS: ['categoryId', 'modifierGroupId', 'sortOrder'],
  CATEGORY_MODIFIERS: ['categoryId', 'modifierId', 'sortOrder'],
  CATEGORY_ITEMS: ['id', 'categoryId', 'itemId', 'sortOrder'],
  ITEM_MODIFIER_GROUP: ['itemId', 'modifierGroupId', 'sortOrder'],
  MODIFIER_GROUP: ['id', 'groupName', 'posDisplayName', 'onPrem', 'offPrem', 'modifierIds'],
  MODIFIER: [
    'id', 'modifierName', 'posDisplayName', 'isNested', 'addNested', 'modifierOptionPriceType',
    'isOptional', 'canGuestSelectMoreModifiers', 'multiSelect', 'limitIndividualModifierSelection',
    'minSelector', 'maxSelector', 'noMaxSelection', 'prefix', 'pizzaSelection', 'stockStatus',
    'price', 'onPrem', 'offPrem', 'parentModifierId', 'isSizeModifier', 'modType',
  ],
  MODIFIER_OPTION: ['id', 'optionName', 'posDisplayName', 'price', 'isStockAvailable', 'isSizeModifier'],
  MODIFIER_MODIFIER_OPTIONS: ['modifierId', 'modifierOptionId', 'isDefaultSelected', 'maxLimit', 'optionDisplayName', 'sortOrder'],
  ALLERGEN: ['id', 'allergenName', 'iconId', 'isDefault'],
  TAG: ['id', 'tagName', 'iconId', 'isDefault'],
  SETTING: ['id', 'type', 'status'],
};

// Convert data array to worksheet with headers (maps each row object by header key).
// Blank values (undefined/null/'') become ABSENT cells, not empty-string cells:
// aoa_to_sheet skips nulls. Real POS exports omit blank cells entirely, and the
// POS-side validator flags any cell that exists but is empty — so writing ''
// here makes otherwise-valid files fail import.
const createSheet = <T extends object>(data: readonly T[], headers: string[]): XLSX.WorkSheet => {
  const rows: unknown[][] = [headers];
  data.forEach((item) => {
    const record = item as Record<string, unknown>;
    rows.push(headers.map((header) => {
      const value = record[header];
      if (value === undefined || value === null) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      return value;
    }));
  });
  return XLSX.utils.aoa_to_sheet(rows);
};

// ---------------------------------------------------------------------------
// Setting sheet — synthesize one Active row per menu/category/item and assign
// each entity a settingId foreign key. Setting ids are their own id space.
// ---------------------------------------------------------------------------
interface SettingMaps {
  settings: Setting[];
  menuSid: Map<number, number>;
  catSid: Map<number, number>;
  itemSid: Map<number, number>;
}

const buildSettings = (data: ExcelMenuData): SettingMaps => {
  const settings: Setting[] = [];
  const menuSid = new Map<number, number>();
  const catSid = new Map<number, number>();
  const itemSid = new Map<number, number>();
  let next = 1;
  for (const it of data.items)      { settings.push({ id: next, type: 'Item',     status: 'Active' }); itemSid.set(it.id, next); next += 1; }
  for (const c of data.categories)  { settings.push({ id: next, type: 'Category', status: 'Active' }); catSid.set(c.id, next);  next += 1; }
  for (const m of data.menus)       { settings.push({ id: next, type: 'Menu',     status: 'Active' }); menuSid.set(m.id, next); next += 1; }
  return { settings, menuSid, catSid, itemSid };
};

// ---------------------------------------------------------------------------
// Per-sheet row builders for sheets that need computed/transformed values.
// (Sheets whose object keys already match the POS columns use createSheet directly.)
// ---------------------------------------------------------------------------

const buildMenuRows = (menus: Menu[], sid: Map<number, number>) =>
  menus.map((m) => ({
    id: m.id, menuName: m.menuName, posDisplayName: m.posDisplayName,
    posButtonColor: m.posButtonColor, picture: m.picture, sortOrder: m.sortOrder,
    settingId: sid.get(m.id) ?? '', visibility: serializeVisibility(m),
  }));

const buildCategoryRows = (cats: Category[], sid: Map<number, number>) =>
  cats.map((c) => ({
    id: c.id, categoryName: c.categoryName, posDisplayName: c.posDisplayName,
    kdsDisplayName: c.kdsDisplayName, color: c.color, image: c.image, kioskImage: c.kioskImage,
    parentCategoryId: c.parentCategoryId ?? '', tagIds: c.tagIds, menuIds: c.menuIds,
    sortOrder: c.sortOrder, settingId: sid.get(c.id) ?? '', visibility: serializeVisibility(c),
  }));

const buildItemRows = (items: Item[], sid: Map<number, number>) =>
  items.map((i) => ({
    id: i.id, itemName: i.itemName, posDisplayName: i.posDisplayName, kdsName: i.kdsName,
    itemDescription: i.itemDescription, itemPicture: i.itemPicture, onlineImage: i.onlineImage,
    landscapeImage: i.landscapeImage, thirdPartyImage: i.thirdPartyImage, kioskItemImage: i.kioskItemImage,
    itemPrice: i.itemPrice, taxLinkedWithParentSetting: i.taxLinkedWithParentSetting,
    calculatePricesWithTaxIncluded: i.calculatePricesWithTaxIncluded, takeoutException: i.takeoutException,
    stockStatus: i.stockStatus, stockValue: i.stockValue, orderQuantityLimit: i.orderQuantityLimit,
    minLimit: i.minLimit, maxLimit: i.maxLimit, noMaxLimit: i.noMaxLimit, stationIds: i.stationIds,
    preparationTime: i.preparationTime, calories: i.calories, tagIds: i.tagIds,
    // saleCategory is required by the POS importer; default blanks to 'Food Sales'.
    inheritTagsFromCategory: i.inheritTagsFromCategory, saleCategory: (i.saleCategory || '').trim() || 'Food Sales',
    allergenIds: i.allergenIds, inheritModifiersFromCategory: i.inheritModifiersFromCategory,
    addonIds: i.addonIds, isSpecialRequest: i.isSpecialRequest,
    // 3PO prices: blank (null) when unset, matching real POS files.
    doordashPrice: i.doordashPrice || '', uberEatsPrice: i.uberEatsPrice || '', grubHubPrice: i.grubHubPrice || '',
    settingId: sid.get(i.id) ?? '', visibility: serializeVisibility(i),
  }));

// Nested-modifier structure: a child→parent map derived from each modifier's
// `modifierIds` list, plus the set of modifier ids that are nested children.
// The POS forbids linking nested modifiers directly to items/categories and
// requires each nested modifier to point at its parent.
interface ModifierNesting {
  childToParent: Map<number, number>;
  nestedIds: Set<number>;
}
const buildModifierNesting = (mods: Modifier[]): ModifierNesting => {
  const childToParent = new Map<number, number>();
  for (const m of mods) {
    String(m.modifierIds || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .forEach((childId) => { if (!childToParent.has(childId)) childToParent.set(childId, m.id); });
  }
  const nestedIds = new Set<number>();
  for (const m of mods) if (m.isNested || childToParent.has(m.id)) nestedIds.add(m.id);
  return { childToParent, nestedIds };
};

// Default prefix for modifiers that have none — the app never sets one, but the
// POS requires it non-empty. "Select any" matches real POS exports.
const resolvePrefix = (s: string): string => ((s || '').trim() ? s : 'Select any');

const buildModifierRows = (mods: Modifier[], nesting: ModifierNesting) =>
  mods.map((m) => {
    // modType is required by the POS importer; fall back when blank (e.g. nested
    // modifiers). isOptional is the boolean form derived from the resolved modType.
    const modType = m.modType || (m.isOptional === 'Required' || m.isOptional === 'Select one' ? 'Required' : 'Optional');
    return {
      id: m.id, modifierName: m.modifierName, posDisplayName: m.posDisplayName,
      isNested: m.isNested, addNested: m.addNested, modifierOptionPriceType: m.modifierOptionPriceType,
      isOptional: modType !== 'Required', // POS expects a boolean
      // POS rule: canGuestSelectMoreModifiers cannot be TRUE when addNested is TRUE.
      canGuestSelectMoreModifiers: m.canGuestSelectMoreModifiers && !m.addNested, multiSelect: m.multiSelect,
      limitIndividualModifierSelection: m.limitIndividualModifierSelection,
      // POS format: when No Max Limit is on, min/max are 1/1 and noMaxSelection carries the "unlimited" meaning.
      minSelector: m.noMaxSelection ? 1 : m.minSelector, maxSelector: m.noMaxSelection ? 1 : m.maxSelector,
      noMaxSelection: m.noMaxSelection,
      prefix: resolvePrefix(m.prefix), pizzaSelection: m.pizzaSelection, stockStatus: true,
      price: m.price, onPrem: m.onPrem, offPrem: m.offPrem,
      // Nested modifiers must reference their parent; backfill from the parent's
      // modifierIds when the modifier's own parentModifierId wasn't set.
      parentModifierId: m.parentModifierId || nesting.childToParent.get(m.id) || '',
      isSizeModifier: m.isSizeModifier, modType,
    };
  });

// POS keeps option surcharge on the Modifier Option `price` column; the app
// stores it on the join's `maxLimit`. Map each option to its surcharge.
const buildOptionPriceMap = (joins: ModifierModifierOption[]): Map<number, number> => {
  const map = new Map<number, number>();
  for (const j of joins) {
    if (!map.has(j.modifierOptionId)) map.set(j.modifierOptionId, j.maxLimit ?? 0);
  }
  return map;
};

// POS importer requires optionName/posDisplayName ≥ 2 chars; pad legacy short names.
const padName = (s: string): string => {
  const t = (s || '').trim();
  return t.length < 2 ? `${t}.` : t;
};

const buildModifierOptionRows = (opts: ModifierOption[], priceMap: Map<number, number>) =>
  opts.map((o) => ({
    id: o.id, optionName: padName(o.optionName), posDisplayName: padName(o.posDisplayName),
    price: priceMap.get(o.id) ?? o.price ?? 0,
    isStockAvailable: o.isStockAvailable, isSizeModifier: o.isSizeModifier,
  }));

// The POS join `maxLimit` is the per-option quantity cap (the app's
// maxQtyPerOption). The surcharge lives on the option row (above). Emit blank
// when there's no cap (0), matching real POS files.
const buildModifierModifierOptionRows = (joins: ModifierModifierOption[]) =>
  joins.map((j) => ({
    modifierId: j.modifierId, modifierOptionId: j.modifierOptionId,
    isDefaultSelected: j.isDefaultSelected,
    maxLimit: j.maxQtyPerOption > 0 ? j.maxQtyPerOption : '',
    optionDisplayName: j.optionDisplayName, sortOrder: j.sortOrder,
  }));

// POS icon catalog ids, keyed by lowercase tag/allergen name. Derived from real
// POS export files (identical across businesses): tag icons 1–12, allergen
// icons 13–24. Names not in the catalog fall back to the first icon of their
// kind — iconId must be a valid id, never blank.
const TAG_ICON_IDS: Record<string, number> = {
  vegan: 1, chicken: 2, beef: 3, seafood: 4, spicy: 5, glutenfree: 6,
  kosher: 7, halal: 8, beer: 9, wine: 10, cocktail: 11, 'non-alcoholic': 12,
  alcohol: 10, 'contains alcohol': 10,
};
const ALLERGEN_ICON_IDS: Record<string, number> = {
  milk: 13, eggs: 14, wheat: 15, soybean: 16, mustard: 17, sesame: 18,
  celery: 19, crustaceans: 20, fish: 21, 'mussels/oyster': 22, 'tree nuts': 23, peanuts: 24,
};

const buildAllergenRows = (allergens: Allergen[]) =>
  allergens.map((a) => ({
    id: a.id, allergenName: a.name,
    iconId: ALLERGEN_ICON_IDS[a.name.trim().toLowerCase()] ?? 13,
    isDefault: false,
  }));

const buildTagRows = (tags: Tag[]) =>
  tags.map((t) => ({
    id: t.id, tagName: t.name,
    iconId: TAG_ICON_IDS[t.name.trim().toLowerCase()] ?? 1,
    isDefault: t.isSystem === true,
  }));

// The POS importer requires sortOrder to be unique within its group (e.g. per
// itemId in Item Modifiers, per modifierId in Modifier ModifierOptions).
// Renumber 1..n within each group, preserving the existing relative order.
const renumberSortOrder = <T extends { sortOrder: number }>(rows: readonly T[], groupKey: (r: T) => number): T[] => {
  const counters = new Map<number, number>();
  return [...rows]
    .sort((a, b) => groupKey(a) - groupKey(b) || a.sortOrder - b.sortOrder)
    .map((r) => {
      const key = groupKey(r);
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return { ...r, sortOrder: next };
    });
};

// ---------------------------------------------------------------------------
// Workbook assembly (shared by exportToExcel and exportToBlob)
// ---------------------------------------------------------------------------
const buildWorkbook = (data: ExcelMenuData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  const { settings, menuSid, catSid, itemSid } = buildSettings(data);
  const optionPriceMap = buildOptionPriceMap(data.modifierModifierOptions);
  const nesting = buildModifierNesting(data.modifiers);

  const append = <T extends object>(rows: readonly T[], headers: string[], name: string) =>
    XLSX.utils.book_append_sheet(workbook, createSheet(rows, headers), name);

  // The POS only allows top-level modifiers to be linked to items/categories;
  // drop any join row pointing at a nested modifier.
  const itemModifiers = renumberSortOrder(
    data.itemModifiers.filter((im) => !nesting.nestedIds.has(im.modifierId)),
    (im) => im.itemId,
  );
  const categoryModifiers = data.categoryModifiers.filter((cm) => !nesting.nestedIds.has(cm.modifierId));

  append(buildMenuRows(data.menus, menuSid), HEADERS.MENU, SHEET_NAMES.MENU);
  append(buildCategoryRows(data.categories, catSid), HEADERS.CATEGORY, SHEET_NAMES.CATEGORY);
  append(buildItemRows(data.items, itemSid), HEADERS.ITEM, SHEET_NAMES.ITEM);
  append(itemModifiers, HEADERS.ITEM_MODIFIERS, SHEET_NAMES.ITEM_MODIFIERS);
  append(data.categoryModifierGroups, HEADERS.CATEGORY_MODIFIER_GROUPS, SHEET_NAMES.CATEGORY_MODIFIER_GROUPS);
  append(categoryModifiers, HEADERS.CATEGORY_MODIFIERS, SHEET_NAMES.CATEGORY_MODIFIERS);
  append(data.categoryItems, HEADERS.CATEGORY_ITEMS, SHEET_NAMES.CATEGORY_ITEMS);
  append(data.itemModifierGroups, HEADERS.ITEM_MODIFIER_GROUP, SHEET_NAMES.ITEM_MODIFIER_GROUP);
  append(data.modifierGroups, HEADERS.MODIFIER_GROUP, SHEET_NAMES.MODIFIER_GROUP);
  append(buildModifierRows(data.modifiers, nesting), HEADERS.MODIFIER, SHEET_NAMES.MODIFIER);
  append(buildModifierOptionRows(data.modifierOptions, optionPriceMap), HEADERS.MODIFIER_OPTION, SHEET_NAMES.MODIFIER_OPTION);
  append(
    renumberSortOrder(buildModifierModifierOptionRows(data.modifierModifierOptions), (r) => r.modifierId),
    HEADERS.MODIFIER_MODIFIER_OPTIONS, SHEET_NAMES.MODIFIER_MODIFIER_OPTIONS,
  );
  append(buildAllergenRows(data.allergens), HEADERS.ALLERGEN, SHEET_NAMES.ALLERGEN);
  append(buildTagRows(data.tags), HEADERS.TAG, SHEET_NAMES.TAG);
  append(settings, HEADERS.SETTING, SHEET_NAMES.SETTING);

  return workbook;
};

/**
 * Export menu data to an Excel file and trigger download.
 */
export const exportToExcel = (data: ExcelMenuData, filename: string = 'menu-data.xlsx'): void => {
  XLSX.writeFile(buildWorkbook(data), filename);
};

/**
 * Export menu data to a Blob (for custom download handling).
 */
export const exportToBlob = (data: ExcelMenuData): Blob => {
  const arrayBuffer = XLSX.write(buildWorkbook(data), { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
