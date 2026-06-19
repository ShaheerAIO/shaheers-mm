import type { ModifierModifierOption } from '@/types/menu';

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
