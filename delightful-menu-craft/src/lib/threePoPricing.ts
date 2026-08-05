// =============================================================================
// Third-party ordering (3PO) per-platform pricing
// =============================================================================
// Per platform (DoorDash / Uber Eats / GrubHub) an operator can either inherit
// pricing from the item's base price, or set independent fixed Pickup and
// Delivery prices. Stored on Item as a JSON-encoded string (`threePoPricing`).
// Store/UI only for now — not yet wired into Excel export/import (pending the
// finalized "Item 3PO" sheet columns).

export const THREE_PO_PLATFORMS = [
  { key: 'doordash', label: 'DoorDash' },
  { key: 'uberEats', label: 'Uber Eats' },
  { key: 'grubHub', label: 'GrubHub' },
] as const;

export type ThreePoPlatform = (typeof THREE_PO_PLATFORMS)[number]['key'];

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
