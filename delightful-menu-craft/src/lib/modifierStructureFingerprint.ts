import type { ModifierModifierOption } from '@/types/menu';

/** Stable sorted list of nested modifier ids from comma-separated `modifierIds`. */
function sortedNestedIds(modifierIds: string): string {
  return modifierIds
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b)
    .join(',');
}

/**
 * Fingerprint option rows + nested links for one modifier so store-only edits
 * (join table, modifierIds) can participate in dirty detection.
 */
export function fingerprintModifierStructure(
  modifierId: number,
  mmoList: ModifierModifierOption[],
  modifierIds: string,
  addNested: boolean,
): string {
  const rows = mmoList
    .filter((m) => m.modifierId === modifierId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.modifierOptionId - b.modifierOptionId)
    .map((m) => {
      const qtyCap = typeof m.maxQtyPerOption === 'number' ? m.maxQtyPerOption : 1;
      return `${m.modifierOptionId}|${m.maxLimit}|${qtyCap}|${m.sortOrder}|${m.isDefaultSelected ? 1 : 0}|${m.optionDisplayName}`;
    });
  return `${sortedNestedIds(modifierIds)}|${addNested ? 1 : 0}|${rows.join(';')}`;
}
