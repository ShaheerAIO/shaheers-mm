// =============================================================================
// Excel Schema Types - These match the Excel file structure exactly
// =============================================================================

// Sheet 1: Menu
export interface Menu {
  id: number;
  menuName: string;
  posDisplayName: string;
  posButtonColor: string;
  picture: string;
  sortOrder: number;
}

// Sheet 2: Category
export interface Category {
  id: number;
  categoryName: string;
  posDisplayName: string;
  kdsDisplayName: string;
  color: string;
  image: string;
  kioskImage: string;
  parentCategoryId: number | null;
  tagIds: string; // comma-separated IDs
  menuIds: string; // comma-separated IDs
  sortOrder: number;
  // Channel visibility (same model as Item)
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityQr: boolean;
  visibilityWebsite: boolean;
  visibilityMobileApp: boolean;
  visibilityDoordash: boolean;
  // Scheduling — JSON-encoded DayScheduleMap (same format as Item)
  daySchedules: string;
}

// Sheet 3: Item
export interface Item {
  id: number;
  itemName: string;
  posDisplayName: string;
  kdsName: string;
  itemDescription: string;
  itemPicture: string;
  onlineImage: string;
  landscapeImage: string;
  thirdPartyImage: string;
  kioskItemImage: string;
  itemPrice: number;
  taxLinkedWithParentSetting: boolean;
  calculatePricesWithTaxIncluded: boolean;
  takeoutException: boolean;
  stockStatus: string; // 'inStock', 'outOfStock', etc.
  stockValue: number;
  orderQuantityLimit: boolean;
  minLimit: number;
  maxLimit: number;
  noMaxLimit: boolean;
  stationIds: string; // comma-separated IDs
  preparationTime: number;
  calories: number;
  tagIds: string; // comma-separated IDs
  inheritTagsFromCategory: boolean;
  saleCategory: string;
  allergenIds: string; // comma-separated IDs
  inheritModifiersFromCategory: boolean;
  addonIds: string; // comma-separated IDs
  isSpecialRequest: boolean;
  // Visibility channels
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityQr: boolean;       // QR code ordering
  visibilityWebsite: boolean;  // Web ordering
  visibilityMobileApp: boolean;// First-party mobile app
  visibilityDoordash: boolean; // DoorDash / 3rd-party delivery
  // Scheduling — JSON-encoded DayScheduleMap (see visibility.ts)
  // Each day key present = day enabled; start/end = "" means no time restriction.
  daySchedules: string;
}

// Sheet 4: Item Modifiers (join table)
export interface ItemModifier {
  itemId: number;
  modifierId: number;
  sortOrder: number;
}

// Sheet 5: Category ModifierGroups (join table)
export interface CategoryModifierGroup {
  modifierGroupId: number;
  categoryId: number;
  sortOrder: number;
}

// Sheet 6: Category Modifiers (join table)
export interface CategoryModifier {
  modifierGroupId: number;
  itemId: number;
  sortOrder: number;
}

// Sheet 7: Category Items (join table)
export interface CategoryItem {
  id: number;
  categoryId: number;
  itemId: number;
  sortOrder: number;
}

// Sheet 8: Item Modifier Group (join table)
export interface ItemModifierGroup {
  modifierId: number;
  groupName: string;
  sortOrder: number;
}

// Sheet 9: Modifier Group
export interface ModifierGroup {
  id: number;
  groupName: string;
  posDisplayName: string;
  onPrem: boolean;
  offPrem: boolean;
  modifierIds: string; // comma-separated IDs
  modifierName: string;
}

// Sheet 10: Modifier
export interface Modifier {
  id: number;
  modifierName: string;
  posDisplayName: string;
  isNested: boolean;
  addNested: boolean;
  modifierOptionPriceType: string; // 'NoCharge', etc.
  isOptional: string; // 'Select any', etc.
  canGuestSelectMoreModifiers: boolean;
  multiSelect: boolean;
  limitIndividualModifierSelection: boolean;
  minSelector: number;
  maxSelector: number;
  noMaxSelection: boolean;
  prefix: string;
  pizzaSelection: boolean;
  price: number;
  parentModifierId: number;
  offPrem: boolean;   // legacy — kept for Excel backward-compat
  modifierIds: string; // comma-separated IDs for nested modifiers
  isSizeModifier: boolean;
  onPrem: boolean;    // legacy — kept for Excel backward-compat
  // Channel visibility (same model as Item)
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityQr: boolean;
  visibilityWebsite: boolean;
  visibilityMobileApp: boolean;
  visibilityDoordash: boolean;
}

// Sheet 11: Modifier Option
export interface ModifierOption {
  id: number;
  optionName: string;
  posDisplayName: string;
  parentModifierId: number;
  isStockAvailable: boolean;
  isSizeModifier: boolean;
  // Channel visibility
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityQr: boolean;
  visibilityWebsite: boolean;
  visibilityMobileApp: boolean;
  visibilityDoordash: boolean;
}

// Sheet 12: Modifier ModifierOptions (join table - links modifiers to their options)
export interface ModifierModifierOption {
  modifierId: number;
  modifierOptionId: number;
  isDefaultSelected: boolean;
  maxLimit: number; // option price/surcharge field
  optionDisplayName: string;
  sortOrder: number;
  /** How many times a guest can select this option. 1 = once (default), 0 = unlimited, N = up to N. */
  maxQtyPerOption: number;
}

// Sheet 13: Allergen
export interface Allergen {
  id: number;
  name: string;
}

// Sheet 14: Tag
export interface Tag {
  id: number;
  name: string;
}

// =============================================================================
// Station Catalog
// =============================================================================

export interface Station {
  id: number;
  name: string;
}

// =============================================================================
// UI State Types
// =============================================================================

export type TabType = 'menu-builder' | 'modifier-library' | 'stations' | 'stats' | 'categories';
export type ViewMode = 'tree' | 'pos-preview';

// =============================================================================
// Complete Excel Data Structure
// =============================================================================

export interface ExcelMenuData {
  menus: Menu[];
  categories: Category[];
  items: Item[];
  itemModifiers: ItemModifier[];
  categoryModifierGroups: CategoryModifierGroup[];
  categoryModifiers: CategoryModifier[];
  categoryItems: CategoryItem[];
  itemModifierGroups: ItemModifierGroup[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
  modifierOptions: ModifierOption[];
  modifierModifierOptions: ModifierModifierOption[];
  allergens: Allergen[];
  tags: Tag[];
}

// Helper type for creating new entities with auto-generated IDs
export type NewEntity<T> = Omit<T, 'id'>;

// =============================================================================
// AI Enhancement Types
// =============================================================================

export type AiPatchKind = 'item_station' | 'item_rename' | 'item_description' | 'category_rename';

export interface AiPatch {
  id: string;
  kind: AiPatchKind;
  entityId: number;
  /** Human-readable summary shown in the review table */
  label: string;
  /** Name of the model field being changed */
  field: string;
  from: string;
  to: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface AiEnhanceResult {
  patches: AiPatch[];
  /** New station names the AI inferred (may not exist in store yet) */
  newStations: string[];
  summary: string;
}
