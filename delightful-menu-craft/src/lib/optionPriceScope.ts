import type {
  Category,
  CategoryItem,
  CategoryModifier,
  Item,
  ItemModifier,
  ModifierModifierOption,
  ModifierOption,
} from '@/types/menu';

/**
 * The POS stores an option surcharge on the Modifier Option row, so one option
 * can only ever carry one price. This app keeps the surcharge on the
 * ModifierModifierOption join, which *can* diverge across modifiers — but that
 * divergence is unrepresentable downstream and the exporter silently keeps the
 * first join's value. So before writing a new price we resolve who else would be
 * dragged along, and either apply it everywhere or fork the shared rows.
 */
export interface OptionPriceScope {
  /** Other modifiers whose joins point at the same option row. */
  otherModifierIds: number[];
  /** Items besides the edited one that this modifier reaches (direct or inherited). */
  otherItemIds: number[];
  /** Categories that push this modifier down onto their items. */
  categoryIds: number[];
  /**
   * The edited item also inherits this modifier from a category. Re-pointing its
   * own attachment then leaves the inherited copy in place, so an item-only price
   * cannot be isolated from here.
   */
  alsoInheritedByItem: boolean;
  /** Anything at all outside this (item, modifier, option) triple is affected. */
  isShared: boolean;
}

/**
 * The price the POS will show for an option. Its joins can no longer disagree, so
 * the first one wins (same rule the exporter applies); an option not yet attached
 * to any modifier falls back to its own row.
 */
export function resolveOptionPrice(
  option: Pick<ModifierOption, 'id' | 'price'>,
  joins: ModifierModifierOption[],
): number {
  const join = joins.find((j) => j.modifierOptionId === option.id);
  return join ? (join.maxLimit ?? 0) : (option.price ?? 0);
}

/** `3 items` / `1 item` — for describing a price change's blast radius. */
export const countLabel = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The category and all of its ancestors, walking `parentCategoryId`. Cycle-safe. */
function selfAndAncestors(categoryId: number, byId: Map<number, Category>): number[] {
  const chain: number[] = [];
  const seen = new Set<number>();
  let cur: number | null = categoryId;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    chain.push(cur);
    cur = byId.get(cur)?.parentCategoryId ?? null;
  }
  return chain;
}

export function resolveOptionPriceScope(params: {
  itemId: number;
  modifierId: number;
  optionId: number;
  items: Item[];
  categories: Category[];
  categoryItems: CategoryItem[];
  categoryModifiers: CategoryModifier[];
  itemModifiers: ItemModifier[];
  modifierModifierOptions: ModifierModifierOption[];
}): OptionPriceScope {
  const {
    itemId, modifierId, optionId,
    items, categories, categoryItems, categoryModifiers, itemModifiers, modifierModifierOptions,
  } = params;

  const otherModifierIds = [...new Set(
    modifierModifierOptions
      .filter((mmo) => mmo.modifierOptionId === optionId && mmo.modifierId !== modifierId)
      .map((mmo) => mmo.modifierId),
  )];

  const categoryIds = [...new Set(
    categoryModifiers.filter((cm) => cm.modifierId === modifierId).map((cm) => cm.categoryId),
  )];

  const reachedItemIds = new Set(
    itemModifiers.filter((im) => im.modifierId === modifierId).map((im) => im.itemId),
  );

  let alsoInheritedByItem = false;
  if (categoryIds.length > 0) {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const attached = new Set(categoryIds);
    // An item can sit in several categories, so collect them all rather than
    // taking the first match.
    const categoriesByItem = new Map<number, number[]>();
    for (const ci of categoryItems) {
      const list = categoriesByItem.get(ci.itemId);
      if (list) list.push(ci.categoryId);
      else categoriesByItem.set(ci.itemId, [ci.categoryId]);
    }
    for (const item of items) {
      if (!item.inheritModifiersFromCategory) continue;
      const inherits = (categoriesByItem.get(item.id) ?? []).some((catId) =>
        selfAndAncestors(catId, categoryById).some((id) => attached.has(id)),
      );
      if (!inherits) continue;
      reachedItemIds.add(item.id);
      if (item.id === itemId) alsoInheritedByItem = true;
    }
  }

  const otherItemIds = [...reachedItemIds].filter((id) => id !== itemId);

  return {
    otherModifierIds,
    otherItemIds,
    categoryIds,
    alsoInheritedByItem,
    isShared: otherModifierIds.length > 0 || otherItemIds.length > 0,
  };
}
