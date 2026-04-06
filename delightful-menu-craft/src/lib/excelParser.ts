import * as XLSX from 'xlsx';
import type {
  Menu,
  Category,
  Item,
  Modifier,
  ModifierOption,
  ModifierGroup,
  ModifierModifierOption,
  ItemModifier,
  CategoryModifierGroup,
  CategoryModifier,
  CategoryItem,
  ItemModifierGroup,
  Allergen,
  Tag,
  ExcelMenuData,
} from '@/types/menu';

// Sheet names as they appear in the Excel file
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

// Helper to safely parse boolean values from Excel
const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  if (typeof value === 'number') return value === 1;
  return false;
};

// Helper to safely parse number values
const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Helper to safely parse string values
const parseString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

// Visibility columns default to true when the cell is absent (backward-compat)
const parseVisibility = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return true;
  return parseBoolean(value);
};

// Parse Menu sheet
const parseMenus = (sheet: XLSX.WorkSheet): Menu[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    menuName: parseString(row['menuName']),
    posDisplayName: parseString(row['posDisplayName']),
    posButtonColor: parseString(row['posButtonColor']),
    picture: parseString(row['picture']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Category sheet
const parseCategories = (sheet: XLSX.WorkSheet): Category[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    categoryName: parseString(row['categoryName']),
    posDisplayName: parseString(row['posDisplayName']),
    kdsDisplayName: parseString(row['kdsDisplayName']),
    color: parseString(row['color']),
    image: parseString(row['image']),
    kioskImage: parseString(row['kioskImage']),
    parentCategoryId: row['parentCategoryId'] ? parseNumber(row['parentCategoryId']) : null,
    tagIds: parseString(row['tagIds']),
    menuIds: parseString(row['menuIds']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Item sheet
const parseItems = (sheet: XLSX.WorkSheet): Item[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    itemName: parseString(row['itemName']),
    posDisplayName: parseString(row['posDisplayName']),
    kdsName: parseString(row['kdsName']),
    itemDescription: parseString(row['itemDescription']),
    itemPicture: parseString(row['itemPicture']),
    onlineImage: parseString(row['onlineImage']),
    landscapeImage: parseString(row['landscapeImage']),
    thirdPartyImage: parseString(row['thirdPartyImage']),
    kioskItemImage: parseString(row['kioskItemImage']),
    itemPrice: parseNumber(row['itemPrice']),
    taxLinkedWithParentSetting: parseBoolean(row['taxLinkedWithParentSetting']),
    calculatePricesWithTaxIncluded: parseBoolean(row['calculatePricesWithTaxIncluded']),
    takeoutException: parseBoolean(row['takeoutException']),
    stockStatus: parseString(row['stockStatus']),
    stockValue: parseNumber(row['stockValue']),
    orderQuantityLimit: parseBoolean(row['orderQuantityLimit']),
    minLimit: parseNumber(row['minLimit']),
    maxLimit: parseNumber(row['maxLimit']),
    noMaxLimit: parseBoolean(row['noMaxLimit']),
    stationIds: parseString(row['stationIds']),
    preparationTime: parseNumber(row['preparationTime']),
    calories: parseNumber(row['calories']),
    tagIds: parseString(row['tagIds']),
    inheritTagsFromCategory: parseBoolean(row['inheritTagsFromCategory']),
    saleCategory: parseString(row['saleCategory']),
    allergenIds: parseString(row['allergenIds']),
    inheritModifiersFromCategory: parseBoolean(row['inheritModifiersFromCategory']),
    addonIds: parseString(row['addonIds']),
    isSpecialRequest: parseBoolean(row['isSpecialRequest']),
    visibilityPos: parseVisibility(row['visibilityPos']),
    visibilityKiosk: parseVisibility(row['visibilityKiosk']),
    visibilityOnline: parseVisibility(row['visibilityOnline']),
    visibilityThirdParty: parseVisibility(row['visibilityThirdParty']),
    availableDays: parseString(row['availableDays']),
    availableTimeStart: parseString(row['availableTimeStart']),
    availableTimeEnd: parseString(row['availableTimeEnd']),
  }));
};

// Parse Item Modifiers join table
const parseItemModifiers = (sheet: XLSX.WorkSheet): ItemModifier[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    itemId: parseNumber(row['itemId']),
    modifierId: parseNumber(row['modifierId']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Category ModifierGroups join table
const parseCategoryModifierGroups = (sheet: XLSX.WorkSheet): CategoryModifierGroup[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    modifierGroupId: parseNumber(row['modifierGroupId']),
    categoryId: parseNumber(row['categoryId']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Category Modifiers join table
const parseCategoryModifiers = (sheet: XLSX.WorkSheet): CategoryModifier[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    modifierGroupId: parseNumber(row['modifierGroupId']),
    itemId: parseNumber(row['itemId']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Category Items join table
const parseCategoryItems = (sheet: XLSX.WorkSheet): CategoryItem[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    categoryId: parseNumber(row['categoryId']),
    itemId: parseNumber(row['itemId']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Item Modifier Group join table
const parseItemModifierGroups = (sheet: XLSX.WorkSheet): ItemModifierGroup[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    modifierId: parseNumber(row['modifierId']),
    groupName: parseString(row['groupName']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Modifier Group sheet
const parseModifierGroups = (sheet: XLSX.WorkSheet): ModifierGroup[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    groupName: parseString(row['groupName']),
    posDisplayName: parseString(row['posDisplayName']),
    onPrem: parseBoolean(row['onPrem']),
    offPrem: parseBoolean(row['offPrem']),
    modifierIds: parseString(row['modifierIds']),
    modifierName: parseString(row['modifierName']),
  }));
};

// Parse Modifier sheet
const parseModifiers = (sheet: XLSX.WorkSheet): Modifier[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    modifierName: parseString(row['modifierName']),
    posDisplayName: parseString(row['posDisplayName']),
    isNested: parseBoolean(row['isNested']),
    addNested: parseBoolean(row['addNested']),
    modifierOptionPriceType: parseString(row['modifierOptionPriceType']),
    isOptional: parseString(row['isOptional']),
    canGuestSelectMoreModifiers: parseBoolean(row['canGuestSelectMoreModifiers']),
    multiSelect: parseBoolean(row['multiSelect']),
    limitIndividualModifierSelection: parseBoolean(row['limitIndividualModifierSelection']),
    minSelector: parseNumber(row['minSelector']),
    maxSelector: parseNumber(row['maxSelector']),
    noMaxSelection: parseBoolean(row['noMaxSelection']),
    prefix: parseString(row['prefix']),
    pizzaSelection: parseBoolean(row['pizzaSelection']),
    price: parseNumber(row['price']),
    parentModifierId: parseNumber(row['parentModifierId']),
    offPrem: parseBoolean(row['offPrem']),
    modifierIds: parseString(row['modifierIds']),
    isSizeModifier: parseBoolean(row['isSizeModifier']),
    onPrem: parseBoolean(row['onPrem']),
  }));
};

// Parse Modifier Option sheet
const parseModifierOptions = (sheet: XLSX.WorkSheet): ModifierOption[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    optionName: parseString(row['optionName']),
    posDisplayName: parseString(row['posDisplayName']),
    parentModifierId: parseNumber(row['parentModifierId']),
    isStockAvailable: parseBoolean(row['isStockAvailable']),
    isSizeModifier: parseBoolean(row['isSizeModifier']),
  }));
};

// Parse Modifier ModifierOptions join table
const parseModifierModifierOptions = (sheet: XLSX.WorkSheet): ModifierModifierOption[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    modifierId: parseNumber(row['modifierId']),
    modifierOptionId: parseNumber(row['modifierOptionId']),
    isDefaultSelected: parseBoolean(row['isDefaultSelected']),
    maxLimit: parseNumber(row['maxLimit']),
    optionDisplayName: parseString(row['optionDisplayName']),
    sortOrder: parseNumber(row['sortOrder']),
  }));
};

// Parse Allergen sheet
const parseAllergens = (sheet: XLSX.WorkSheet): Allergen[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    name: parseString(row['name']),
  }));
};

// Parse Tag sheet
const parseTags = (sheet: XLSX.WorkSheet): Tag[] => {
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return data.map((row) => ({
    id: parseNumber(row['id']),
    name: parseString(row['name']),
  }));
};

/**
 * Parse an Excel file and return structured menu data
 */
export const parseExcelFile = async (file: File): Promise<ExcelMenuData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Helper to safely get a sheet (returns empty array if sheet doesn't exist)
        const getSheet = (name: string): XLSX.WorkSheet | null => {
          return workbook.Sheets[name] || null;
        };
        
        const result: ExcelMenuData = {
          menus: [],
          categories: [],
          items: [],
          itemModifiers: [],
          categoryModifierGroups: [],
          categoryModifiers: [],
          categoryItems: [],
          itemModifierGroups: [],
          modifierGroups: [],
          modifiers: [],
          modifierOptions: [],
          modifierModifierOptions: [],
          allergens: [],
          tags: [],
        };
        
        // Parse each sheet
        const menuSheet = getSheet(SHEET_NAMES.MENU);
        if (menuSheet) result.menus = parseMenus(menuSheet);
        
        const categorySheet = getSheet(SHEET_NAMES.CATEGORY);
        if (categorySheet) result.categories = parseCategories(categorySheet);
        
        const itemSheet = getSheet(SHEET_NAMES.ITEM);
        if (itemSheet) result.items = parseItems(itemSheet);
        
        const itemModifiersSheet = getSheet(SHEET_NAMES.ITEM_MODIFIERS);
        if (itemModifiersSheet) result.itemModifiers = parseItemModifiers(itemModifiersSheet);
        
        const categoryModifierGroupsSheet = getSheet(SHEET_NAMES.CATEGORY_MODIFIER_GROUPS);
        if (categoryModifierGroupsSheet) result.categoryModifierGroups = parseCategoryModifierGroups(categoryModifierGroupsSheet);
        
        const categoryModifiersSheet = getSheet(SHEET_NAMES.CATEGORY_MODIFIERS);
        if (categoryModifiersSheet) result.categoryModifiers = parseCategoryModifiers(categoryModifiersSheet);
        
        const categoryItemsSheet = getSheet(SHEET_NAMES.CATEGORY_ITEMS);
        if (categoryItemsSheet) result.categoryItems = parseCategoryItems(categoryItemsSheet);
        
        const itemModifierGroupSheet = getSheet(SHEET_NAMES.ITEM_MODIFIER_GROUP);
        if (itemModifierGroupSheet) result.itemModifierGroups = parseItemModifierGroups(itemModifierGroupSheet);
        
        const modifierGroupSheet = getSheet(SHEET_NAMES.MODIFIER_GROUP);
        if (modifierGroupSheet) result.modifierGroups = parseModifierGroups(modifierGroupSheet);
        
        const modifierSheet = getSheet(SHEET_NAMES.MODIFIER);
        if (modifierSheet) result.modifiers = parseModifiers(modifierSheet);
        
        const modifierOptionSheet = getSheet(SHEET_NAMES.MODIFIER_OPTION);
        if (modifierOptionSheet) result.modifierOptions = parseModifierOptions(modifierOptionSheet);
        
        const modifierModifierOptionsSheet = getSheet(SHEET_NAMES.MODIFIER_MODIFIER_OPTIONS);
        if (modifierModifierOptionsSheet) result.modifierModifierOptions = parseModifierModifierOptions(modifierModifierOptionsSheet);
        
        const allergenSheet = getSheet(SHEET_NAMES.ALLERGEN);
        if (allergenSheet) result.allergens = parseAllergens(allergenSheet);
        
        const tagSheet = getSheet(SHEET_NAMES.TAG);
        if (tagSheet) result.tags = parseTags(tagSheet);
        
        console.log('Imported:', {
          menus: result.menus.length,
          categories: result.categories.length,
          items: result.items.length,
          modifiers: result.modifiers.length,
        });
        
        resolve(result);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      reject(error);
    };
    
    reader.readAsBinaryString(file);
  });
};

