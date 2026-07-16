import type { Item, ItemModifier, Modifier, ModifierModifierOption } from '@/types/menu';

interface OptionUsageDeps {
  modifierModifierOptions: ModifierModifierOption[];
  modifiers: Modifier[];
  itemModifiers: ItemModifier[];
  items: Item[];
}

/**
 * Every item affected by a change to a modifier option, resolved through the
 * option → modifier(s) → item chain.
 *
 * Items bind to modifiers via `itemModifiers` (category-inherited modifiers are
 * materialized into that join, so it is the source of truth). Because an option
 * may sit on a nested child modifier while the item binds to the top-level
 * parent, we also walk up each modifier's `parentModifierId` chain.
 */
export function getItemsUsingOption(optionId: number, deps: OptionUsageDeps): Item[] {
  const { modifierModifierOptions, modifiers, itemModifiers, items } = deps;

  const directModifierIds = new Set(
    modifierModifierOptions
      .filter((mmo) => mmo.modifierOptionId === optionId)
      .map((mmo) => mmo.modifierId),
  );
  if (directModifierIds.size === 0) return [];

  // Expand upward to include ancestor modifiers (items may bind to the parent).
  const byId = new Map(modifiers.map((m) => [m.id, m]));
  const relevantModifierIds = new Set<number>();
  for (const start of directModifierIds) {
    let current: number | undefined = start;
    while (current != null && current !== 0 && !relevantModifierIds.has(current)) {
      relevantModifierIds.add(current);
      current = byId.get(current)?.parentModifierId;
    }
  }

  const itemIds = new Set(
    itemModifiers
      .filter((im) => relevantModifierIds.has(im.modifierId))
      .map((im) => im.itemId),
  );

  return items.filter((i) => itemIds.has(i.id));
}
