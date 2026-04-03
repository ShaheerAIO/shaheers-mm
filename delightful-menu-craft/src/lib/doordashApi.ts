// Types for DoorDash / scraper payloads (Chrome extension, JSON files).
// Remote scraper API calls were removed — use the browser extension to import.

export interface ScraperMenu {
  id: number;
  menuName: string;
  posDisplayName: string;
  posButtonColor: string | null;
  picture: string | null;
  sortOrder: number;
}

export interface ScraperCategory {
  id: number;
  categoryName: string;
  posDisplayName: string;
  kdsDisplayName: string;
  color: string | null;
  image: string | null;
  kioskImage: string | null;
  parentCategoryId: number | null;
  tagIds: string | null;
  menuIds: string;
  sortOrder: number;
}

export interface ScraperItem {
  id: number;
  itemName: string;
  posDisplayName: string;
  kdsName: string;
  itemDescription: string | null;
  itemPicture: string | null;
  onlineImage: string | null;
  landscapeImage: string | null;
  thirdPartyImage: string | null;
  kioskItemImage: string | null;
  itemPrice: number;
  taxLinkedWithParentSetting: boolean;
  calculatePricesWithTaxIncluded: boolean;
  takeoutException: boolean;
  stockStatus: string;
  stockValue: number;
  orderQuantityLimit: boolean;
  minLimit: number;
  maxLimit: number;
  noMaxLimit: boolean;
  stationIds: string | null;
  preparationTime: number | null;
  calories: number | null;
  tagIds: string | null;
  inheritTagsFromCategory: boolean;
  saleCategory: string;
  allergenIds: string | null;
  inheritModifiersFromCategory: boolean;
  addonIds: string | null;
  isSpecialRequest: boolean;
  visibilityPos?: boolean;
  visibilityKiosk?: boolean;
  visibilityOnline?: boolean;
  visibilityThirdParty?: boolean;
  availableDays?: string;
  availableTimeStart?: string;
  availableTimeEnd?: string;
}

export interface ScraperCategoryItem {
  id: number;
  categoryId: number;
  itemId: number;
  sortOrder: number;
}

export interface ScraperMenuData {
  store_id: string;
  Menu: ScraperMenu[];
  Category: ScraperCategory[];
  Item: ScraperItem[];
  'Item Modifiers': unknown[];
  'Category ModifierGroups': unknown[];
  'Category Modifiers': unknown[];
  'Category Items': ScraperCategoryItem[];
  'Item Modifier Group': unknown[];
  'Modifier Group': unknown[];
  Modifier: unknown[];
  'Modifier Option': unknown[];
  'Modifier ModifierOptions': unknown[];
  Allergen: unknown[];
  Tag: unknown[];
}
