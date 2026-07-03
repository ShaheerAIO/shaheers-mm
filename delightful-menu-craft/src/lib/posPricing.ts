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

/**
 * Dynamic ceiling for a modifier's Max SELECTION cap, driven by three toggles:
 *   T1 multiSelect      — allow selecting more than one option
 *   T2 allowRepeat      — allow selecting the SAME option more than once
 *   T3 limitPerOption   — per-option individual max limits (maxQtyPerOption)
 *
 * Rules:
 *   T1 off                       → ceiling = 1 (single select)
 *   T1 on, T2 off                → Scenario A: ceiling = optionCount
 *   T1 on, T2 on, T3 off         → Scenario B: ceiling = Infinity (unbounded)
 *   T1 on, T2 on, T3 on          → Scenario C: ceiling = sum of per-option
 *                                  maxQtyPerOption; a limit of 0 means "unlimited",
 *                                  so any 0 makes the ceiling Infinity.
 */
export function modifierSelectionCeiling(opts: {
  multiSelect: boolean;
  allowRepeat: boolean; // canGuestSelectMoreModifiers
  limitPerOption: boolean; // limitIndividualModifierSelection
  optionCount: number;
  perOptionLimits: number[]; // maxQtyPerOption for each option
}): number {
  const { multiSelect, allowRepeat, limitPerOption, optionCount, perOptionLimits } = opts;
  if (!multiSelect) return 1;
  if (!allowRepeat) return optionCount; // Scenario A
  if (!limitPerOption) return Infinity; // Scenario B
  // Scenario C: sum per-option limits; 0 = unlimited → Infinity
  if (perOptionLimits.some((n) => n === 0)) return Infinity;
  return perOptionLimits.reduce((sum, n) => sum + n, 0);
}
