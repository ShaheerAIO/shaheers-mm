import type { Modifier, ModifierModifierOption } from '@/types/menu';

/**
 * Sum join-table `maxLimit` (the per-option surcharge) for each selected option
 * occurrence. Duplicate option ids in the array represent multi-quantity picks.
 *
 * Shared by the POS preview and the kiosk preview so per-line money math is
 * identical across both surfaces.
 */
export function modifierSurchargePerUnit(
  selectedOptions: Record<number, number[]>,
  modifierModifierOptions: ModifierModifierOption[],
): number {
  let sum = 0;
  for (const [modIdStr, ids] of Object.entries(selectedOptions)) {
    const modId = Number(modIdStr);
    if (!Number.isFinite(modId)) continue;
    if (!Array.isArray(ids)) continue;
    for (const optionId of ids) {
      const mmo = modifierModifierOptions.find(
        (m) => m.modifierId === modId && m.modifierOptionId === optionId,
      );
      sum += mmo?.maxLimit ?? 0;
    }
  }
  return sum;
}

/**
 * Effective per-unit price for a line, honoring absolute size pricing.
 * If a size modifier (isSizeModifier) has a selected option, that option's
 * price (join maxLimit) REPLACES the item base price; all non-size selected
 * options still add as surcharges. If no size is selected (or no size
 * modifier), falls back to itemPrice + all surcharges.
 */
export function effectiveUnitPrice(
  itemPrice: number,
  selectedOptions: Record<number, number[]>,
  modifiers: Pick<Modifier, 'id' | 'isSizeModifier'>[],
  modifierModifierOptions: ModifierModifierOption[],
): number {
  const sizeModIds = new Set(modifiers.filter((m) => m.isSizeModifier).map((m) => m.id));
  let sizeAbsolute: number | null = null;
  let surcharge = 0;
  for (const [modIdStr, ids] of Object.entries(selectedOptions)) {
    const modId = Number(modIdStr);
    if (!Number.isFinite(modId) || !Array.isArray(ids)) continue;
    const isSize = sizeModIds.has(modId);
    for (const optionId of ids) {
      const mmo = modifierModifierOptions.find(
        (m) => m.modifierId === modId && m.modifierOptionId === optionId,
      );
      const price = mmo?.maxLimit ?? 0;
      if (isSize) sizeAbsolute = price; // single-select size: last wins
      else surcharge += price;
    }
  }
  const base = sizeAbsolute !== null ? sizeAbsolute : itemPrice;
  return base + surcharge;
}
