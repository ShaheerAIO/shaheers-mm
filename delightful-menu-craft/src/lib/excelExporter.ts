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
const createSheet = <T extends object>(data: readonly T[], headers: string[]): XLSX.WorkSheet => {
  const rows: unknown[][] = [headers];
  data.forEach((item) => {
    const record = item as Record<string, unknown>;
    rows.push(headers.map((header) => {
      const value = record[header];
      if (value === undefined || value === null) return '';
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
    inheritTagsFromCategory: i.inheritTagsFromCategory, saleCategory: i.saleCategory,
    allergenIds: i.allergenIds, inheritModifiersFromCategory: i.inheritModifiersFromCategory,
    addonIds: i.addonIds, isSpecialRequest: i.isSpecialRequest,
    // 3PO prices: blank (null) when unset, matching real POS files.
    doordashPrice: i.doordashPrice || '', uberEatsPrice: i.uberEatsPrice || '', grubHubPrice: i.grubHubPrice || '',
    settingId: sid.get(i.id) ?? '', visibility: serializeVisibility(i),
  }));

const buildModifierRows = (mods: Modifier[]) =>
  mods.map((m) => ({
    id: m.id, modifierName: m.modifierName, posDisplayName: m.posDisplayName,
    isNested: m.isNested, addNested: m.addNested, modifierOptionPriceType: m.modifierOptionPriceType,
    isOptional: m.modType !== 'Required', // POS expects a boolean
    canGuestSelectMoreModifiers: m.canGuestSelectMoreModifiers, multiSelect: m.multiSelect,
    limitIndividualModifierSelection: m.limitIndividualModifierSelection,
    minSelector: m.minSelector, maxSelector: m.maxSelector, noMaxSelection: m.noMaxSelection,
    prefix: m.prefix, pizzaSelection: m.pizzaSelection, stockStatus: true,
    price: m.price, onPrem: m.onPrem, offPrem: m.offPrem,
    parentModifierId: m.parentModifierId || '', isSizeModifier: m.isSizeModifier, modType: m.modType,
  }));

// POS keeps option surcharge on the Modifier Option `price` column; the app
// stores it on the join's `maxLimit`. Map each option to its surcharge.
const buildOptionPriceMap = (joins: ModifierModifierOption[]): Map<number, number> => {
  const map = new Map<number, number>();
  for (const j of joins) {
    if (!map.has(j.modifierOptionId)) map.set(j.modifierOptionId, j.maxLimit ?? 0);
  }
  return map;
};

const buildModifierOptionRows = (opts: ModifierOption[], priceMap: Map<number, number>) =>
  opts.map((o) => ({
    id: o.id, optionName: o.optionName, posDisplayName: o.posDisplayName,
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

const buildAllergenRows = (allergens: Allergen[]) =>
  allergens.map((a) => ({ id: a.id, allergenName: a.name, iconId: '', isDefault: false }));

const buildTagRows = (tags: Tag[]) =>
  tags.map((t) => ({ id: t.id, tagName: t.name, iconId: '', isDefault: t.isSystem === true }));

// ---------------------------------------------------------------------------
// Workbook assembly (shared by exportToExcel and exportToBlob)
// ---------------------------------------------------------------------------
const buildWorkbook = (data: ExcelMenuData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  const { settings, menuSid, catSid, itemSid } = buildSettings(data);
  const optionPriceMap = buildOptionPriceMap(data.modifierModifierOptions);

  const append = <T extends object>(rows: readonly T[], headers: string[], name: string) =>
    XLSX.utils.book_append_sheet(workbook, createSheet(rows, headers), name);

  append(buildMenuRows(data.menus, menuSid), HEADERS.MENU, SHEET_NAMES.MENU);
  append(buildCategoryRows(data.categories, catSid), HEADERS.CATEGORY, SHEET_NAMES.CATEGORY);
  append(buildItemRows(data.items, itemSid), HEADERS.ITEM, SHEET_NAMES.ITEM);
  append(data.itemModifiers, HEADERS.ITEM_MODIFIERS, SHEET_NAMES.ITEM_MODIFIERS);
  append(data.categoryModifierGroups, HEADERS.CATEGORY_MODIFIER_GROUPS, SHEET_NAMES.CATEGORY_MODIFIER_GROUPS);
  append(data.categoryModifiers, HEADERS.CATEGORY_MODIFIERS, SHEET_NAMES.CATEGORY_MODIFIERS);
  append(data.categoryItems, HEADERS.CATEGORY_ITEMS, SHEET_NAMES.CATEGORY_ITEMS);
  append(data.itemModifierGroups, HEADERS.ITEM_MODIFIER_GROUP, SHEET_NAMES.ITEM_MODIFIER_GROUP);
  append(data.modifierGroups, HEADERS.MODIFIER_GROUP, SHEET_NAMES.MODIFIER_GROUP);
  append(buildModifierRows(data.modifiers), HEADERS.MODIFIER, SHEET_NAMES.MODIFIER);
  append(buildModifierOptionRows(data.modifierOptions, optionPriceMap), HEADERS.MODIFIER_OPTION, SHEET_NAMES.MODIFIER_OPTION);
  append(buildModifierModifierOptionRows(data.modifierModifierOptions), HEADERS.MODIFIER_MODIFIER_OPTIONS, SHEET_NAMES.MODIFIER_MODIFIER_OPTIONS);
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
