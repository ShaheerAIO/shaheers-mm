import * as XLSX from 'xlsx';
import type { ExcelMenuData } from '@/types/menu';

// Sheet names matching the original Excel file
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
};

// Column headers for each sheet (matching Excel exactly)
const HEADERS = {
  MENU: ['id', 'menuName', 'posDisplayName', 'posButtonColor', 'picture', 'sortOrder'],
  CATEGORY: ['id', 'categoryName', 'posDisplayName', 'kdsDisplayName', 'color', 'image', 'kioskImage', 'parentCategoryId', 'tagIds', 'menuIds', 'sortOrder'],
  ITEM: [
    'id', 'itemName', 'posDisplayName', 'kdsName', 'itemDescription', 'itemPicture', 
    'onlineImage', 'landscapeImage', 'thirdPartyImage', 'kioskItemImage', 'itemPrice',
    'taxLinkedWithParentSetting', 'calculatePricesWithTaxIncluded', 'takeoutException',
    'stockStatus', 'stockValue', 'orderQuantityLimit', 'minLimit', 'maxLimit', 'noMaxLimit',
    'stationIds', 'preparationTime', 'calories', 'tagIds', 'inheritTagsFromCategory',
    'saleCategory', 'allergenIds', 'inheritModifiersFromCategory', 'addonIds', 'isSpecialRequest'
  ],
  ITEM_MODIFIERS: ['itemId', 'modifierId', 'sortOrder'],
  CATEGORY_MODIFIER_GROUPS: ['modifierGroupId', 'categoryId', 'sortOrder'],
  CATEGORY_MODIFIERS: ['modifierGroupId', 'itemId', 'sortOrder'],
  CATEGORY_ITEMS: ['id', 'categoryId', 'itemId', 'sortOrder'],
  ITEM_MODIFIER_GROUP: ['modifierId', 'groupName', 'sortOrder'],
  MODIFIER_GROUP: ['id', 'groupName', 'posDisplayName', 'onPrem', 'offPrem', 'modifierIds', 'modifierName'],
  MODIFIER: [
    'id', 'modifierName', 'posDisplayName', 'isNested', 'addNested', 'modifierOptionPriceType',
    'isOptional', 'canGuestSelectMoreModifiers', 'multiSelect', 'limitIndividualModifierSelection',
    'minSelector', 'maxSelector', 'noMaxSelection', 'prefix', 'pizzaSelection', 'price',
    'parentModifierId', 'offPrem', 'modifierIds', 'isSizeModifier', 'onPrem'
  ],
  MODIFIER_OPTION: ['id', 'optionName', 'posDisplayName', 'parentModifierId', 'isStockAvailable', 'isSizeModifier'],
  MODIFIER_MODIFIER_OPTIONS: ['modifierId', 'modifierOptionId', 'isDefaultSelected', 'maxLimit', 'optionDisplayName', 'sortOrder'],
  ALLERGEN: ['id', 'name'],
  TAG: ['id', 'name'],
};

// Convert data array to worksheet with headers
const createSheet = <T extends Record<string, unknown>>(data: T[], headers: string[]): XLSX.WorkSheet => {
  // Create array of arrays with header row first
  const rows: unknown[][] = [headers];
  
  // Add data rows
  data.forEach((item) => {
    const row = headers.map((header) => {
      const value = item[header];
      // Convert undefined/null to empty string
      if (value === undefined || value === null) return '';
      // Keep booleans as booleans for Excel
      if (typeof value === 'boolean') return value;
      return value;
    });
    rows.push(row);
  });
  
  return XLSX.utils.aoa_to_sheet(rows);
};

/**
 * Export menu data to an Excel file and trigger download
 */
export const exportToExcel = (data: ExcelMenuData, filename: string = 'menu-data.xlsx'): void => {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  
  // Add sheets in the same order as the original file
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.menus, HEADERS.MENU),
    SHEET_NAMES.MENU
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.categories, HEADERS.CATEGORY),
    SHEET_NAMES.CATEGORY
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.items, HEADERS.ITEM),
    SHEET_NAMES.ITEM
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.itemModifiers, HEADERS.ITEM_MODIFIERS),
    SHEET_NAMES.ITEM_MODIFIERS
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.categoryModifierGroups, HEADERS.CATEGORY_MODIFIER_GROUPS),
    SHEET_NAMES.CATEGORY_MODIFIER_GROUPS
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.categoryModifiers, HEADERS.CATEGORY_MODIFIERS),
    SHEET_NAMES.CATEGORY_MODIFIERS
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.categoryItems, HEADERS.CATEGORY_ITEMS),
    SHEET_NAMES.CATEGORY_ITEMS
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.itemModifierGroups, HEADERS.ITEM_MODIFIER_GROUP),
    SHEET_NAMES.ITEM_MODIFIER_GROUP
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.modifierGroups, HEADERS.MODIFIER_GROUP),
    SHEET_NAMES.MODIFIER_GROUP
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.modifiers, HEADERS.MODIFIER),
    SHEET_NAMES.MODIFIER
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.modifierOptions, HEADERS.MODIFIER_OPTION),
    SHEET_NAMES.MODIFIER_OPTION
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.modifierModifierOptions, HEADERS.MODIFIER_MODIFIER_OPTIONS),
    SHEET_NAMES.MODIFIER_MODIFIER_OPTIONS
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.allergens, HEADERS.ALLERGEN),
    SHEET_NAMES.ALLERGEN
  );
  
  XLSX.utils.book_append_sheet(
    workbook,
    createSheet(data.tags, HEADERS.TAG),
    SHEET_NAMES.TAG
  );
  
  // Generate the file and trigger download
  XLSX.writeFile(workbook, filename);
};

/**
 * Export menu data to a Blob (for custom download handling)
 */
export const exportToBlob = (data: ExcelMenuData): Blob => {
  const workbook = XLSX.utils.book_new();
  
  // Add all sheets (same as above)
  XLSX.utils.book_append_sheet(workbook, createSheet(data.menus, HEADERS.MENU), SHEET_NAMES.MENU);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.categories, HEADERS.CATEGORY), SHEET_NAMES.CATEGORY);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.items, HEADERS.ITEM), SHEET_NAMES.ITEM);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.itemModifiers, HEADERS.ITEM_MODIFIERS), SHEET_NAMES.ITEM_MODIFIERS);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.categoryModifierGroups, HEADERS.CATEGORY_MODIFIER_GROUPS), SHEET_NAMES.CATEGORY_MODIFIER_GROUPS);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.categoryModifiers, HEADERS.CATEGORY_MODIFIERS), SHEET_NAMES.CATEGORY_MODIFIERS);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.categoryItems, HEADERS.CATEGORY_ITEMS), SHEET_NAMES.CATEGORY_ITEMS);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.itemModifierGroups, HEADERS.ITEM_MODIFIER_GROUP), SHEET_NAMES.ITEM_MODIFIER_GROUP);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.modifierGroups, HEADERS.MODIFIER_GROUP), SHEET_NAMES.MODIFIER_GROUP);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.modifiers, HEADERS.MODIFIER), SHEET_NAMES.MODIFIER);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.modifierOptions, HEADERS.MODIFIER_OPTION), SHEET_NAMES.MODIFIER_OPTION);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.modifierModifierOptions, HEADERS.MODIFIER_MODIFIER_OPTIONS), SHEET_NAMES.MODIFIER_MODIFIER_OPTIONS);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.allergens, HEADERS.ALLERGEN), SHEET_NAMES.ALLERGEN);
  XLSX.utils.book_append_sheet(workbook, createSheet(data.tags, HEADERS.TAG), SHEET_NAMES.TAG);
  
  // Generate as array buffer and convert to Blob
  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

