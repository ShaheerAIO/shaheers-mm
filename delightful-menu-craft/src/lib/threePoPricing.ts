// =============================================================================
// Third-party ordering (3PO) per-platform pricing
// =============================================================================
// Per platform (DoorDash / Uber Eats / GrubHub) an operator can either inherit
// pricing from the base price, or set independent fixed Pickup and Delivery
// prices. Stored as a JSON-encoded string (`threePoPricing`) on both Item and
// ModifierOption — items inherit their `itemPrice`, options their surcharge.
// Excel export maps these to the "Item 3PO" and "Modifier Option 3PO" sheets
// (see excelExporter).

export const THREE_PO_PLATFORMS = [
  { key: 'doordash', label: 'DoorDash' },
  { key: 'uberEats', label: 'Uber Eats' },
  { key: 'grubHub', label: 'GrubHub' },
] as const;

export type ThreePoPlatform = (typeof THREE_PO_PLATFORMS)[number]['key'];

// Excel `tpoType` column uses snake_case platform ids, distinct from the
// internal camelCase keys used elsewhere in code/UI.
export const THREE_PO_TYPE_EXCEL: Record<ThreePoPlatform, string> = {
  doordash: 'doordash',
  uberEats: 'uber_eats',
  grubHub: 'grubhub',
};

export interface ThreePoPlatformPricing {
  /** When true, the platform inherits the item's base price (no adjustment). */
  inherit: boolean;
  /** Fixed pickup price used when inherit is false. */
  pickupPrice: number;
  /** Fixed delivery price used when inherit is false. */
  deliveryPrice: number;
}

export type ThreePoPricing = Record<ThreePoPlatform, ThreePoPlatformPricing>;

export function defaultPlatformPricing(): ThreePoPlatformPricing {
  return { inherit: true, pickupPrice: 0, deliveryPrice: 0 };
}

export function defaultThreePoPricing(): ThreePoPricing {
  return {
    doordash: defaultPlatformPricing(),
    uberEats: defaultPlatformPricing(),
    grubHub: defaultPlatformPricing(),
  };
}

/** Read a stored 3PO pricing blob, falling back to all-inherit defaults. */
export function parseThreePoPricing(raw: string | undefined): ThreePoPricing {
  const base = defaultThreePoPricing();
  if (!raw?.trim()) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ThreePoPlatform, Partial<ThreePoPlatformPricing>>>;
    THREE_PO_PLATFORMS.forEach(({ key }) => {
      const p = parsed?.[key];
      if (p && typeof p === 'object') {
        base[key] = {
          inherit: p.inherit ?? true,
          pickupPrice: typeof p.pickupPrice === 'number' ? p.pickupPrice : 0,
          deliveryPrice: typeof p.deliveryPrice === 'number' ? p.deliveryPrice : 0,
        };
      }
    });
  } catch {
    // Malformed — fall back to defaults.
  }
  return base;
}

export function serializeThreePoPricing(pricing: ThreePoPricing): string {
  return JSON.stringify(pricing);
}

/** True when at least one platform overrides the base price. */
export function hasThreePoOverride(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  const pricing = parseThreePoPricing(raw);
  return THREE_PO_PLATFORMS.some(({ key }) => !pricing[key].inherit);
}
