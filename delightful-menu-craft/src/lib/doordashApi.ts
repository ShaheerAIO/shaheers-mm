const API_BASE_URL = (import.meta.env.VITE_SCRAPER_API_BASE_URL as string | undefined) ?? '';

// ---------------------------------------------------------------------------
// Types matching the mapper.py output schema
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function getApiBase(): string {
  if (!API_BASE_URL) {
    throw new Error(
      'Scraper API URL is not configured. Set VITE_SCRAPER_API_BASE_URL in your .env file.',
    );
  }
  return API_BASE_URL.replace(/\/$/, '');
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 429) {
    throw new Error('Rate limit exceeded. Please wait a minute before trying again.');
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // ignore parse error
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * Scrape a DoorDash store URL and return normalized menu JSON.
 * Calls POST /api/scrape-json on the scraper backend.
 */
export async function scrapeByUrl(url: string): Promise<ScraperMenuData> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/scrape-json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(90_000),
  });
  return handleResponse<ScraperMenuData>(res);
}

/**
 * Normalize a raw scrape_store() JSON payload via the backend.
 * Calls POST /api/normalize on the scraper backend.
 */
export async function normalizeRawPayload(payload: unknown): Promise<ScraperMenuData> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/normalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  return handleResponse<ScraperMenuData>(res);
}

/**
 * Health check — returns true if the scraper API is reachable.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Validate whether a string looks like a DoorDash store URL.
 */
export function isValidDoorDashUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.doordash.com' || parsed.hostname === 'doordash.com') &&
      parsed.pathname.includes('/store/')
    );
  } catch {
    return false;
  }
}
