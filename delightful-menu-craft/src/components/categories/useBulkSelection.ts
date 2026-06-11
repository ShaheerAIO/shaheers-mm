import { useMemo, useState, useCallback } from 'react';
import { useMenuStore } from '@/store/menuStore';
import type {
  Category,
  Item,
  Modifier,
  ModifierOption,
  ModifierModifierOption,
} from '@/types/menu';

// =============================================================================
// Bulk console core: hierarchy navigation (Menu › Category › Item › Modifier ›
// Option), cascade target resolution, and multi-level selection.
//
// Selection is by ENTITY IDENTITY (level + id), not by tree path — an item
// that appears in two categories is one bulk target. Selecting a node
// cascades to every descendant entity it reaches through the join tables.
// =============================================================================

export type BulkLevel = 'menu' | 'category' | 'item' | 'modifier' | 'option';

export const bulkKey = (level: BulkLevel, id: number) => `${level}:${id}`;

export const LEVEL_COLORS: Record<BulkLevel, string> = {
  menu: '#f26f21',
  category: '#6366f1',
  item: '#22c55e',
  modifier: '#eab308',
  option: '#ec4899',
};

export interface BulkTargets {
  menuIds: Set<number>;
  categoryIds: Set<number>;
  itemIds: Set<number>;
  modifierIds: Set<number>;
  optionIds: Set<number>;
  /** Reached (modifierId:optionId) join pairs — needed for option surcharge edits. */
  pairKeys: Set<string>;
}

const emptyTargets = (): BulkTargets => ({
  menuIds: new Set(),
  categoryIds: new Set(),
  itemIds: new Set(),
  modifierIds: new Set(),
  optionIds: new Set(),
  pairKeys: new Set(),
});

interface BulkData {
  categories: Category[];
  items: Item[];
  modifiers: Modifier[];
  modifierOptions: ModifierOption[];
  categoryItems: { categoryId: number; itemId: number; sortOrder: number }[];
  itemModifiers: { itemId: number; modifierId: number; sortOrder: number }[];
  modifierModifierOptions: ModifierModifierOption[];
}

export const parseCsvIds = (csv: string | undefined): number[] => {
  if (!csv?.trim()) return [];
  return csv
    .split(',')
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
};

// ---------------------------------------------------------------------------
// Child accessors (drive both the columns and the cascade resolver)
// ---------------------------------------------------------------------------

/** Root categories of a menu, sorted. Subcategories hang off parentCategoryId. */
export function rootCategoriesForMenu(menuId: number, categories: Category[]): Category[] {
  return categories
    .filter((c) => !c.parentCategoryId && parseCsvIds(c.menuIds).includes(menuId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function subcategoriesOf(parentId: number, categories: Category[]): Category[] {
  return categories
    .filter((c) => c.parentCategoryId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Menu's categories flattened root-first with depth for indentation. */
export function categoriesForMenuFlat(
  menuId: number,
  categories: Category[],
): { category: Category; depth: number }[] {
  const out: { category: Category; depth: number }[] = [];
  const walk = (cat: Category, depth: number) => {
    out.push({ category: cat, depth });
    subcategoriesOf(cat.id, categories).forEach((sub) => walk(sub, depth + 1));
  };
  rootCategoriesForMenu(menuId, categories).forEach((c) => walk(c, 0));
  return out;
}

/** Items linked directly to one category (no subcategory recursion), join-ordered. */
export function itemsForCategoryDirect(categoryId: number, data: BulkData): Item[] {
  const ids = data.categoryItems
    .filter((ci) => ci.categoryId === categoryId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ci) => ci.itemId);
  const seen = new Set<number>();
  const out: Item[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = data.items.find((i) => i.id === id);
    if (item) out.push(item);
  }
  return out;
}

/** Items of a category including all its subcategories (deduped). */
export function itemsForCategoryScope(categoryId: number, data: BulkData): Item[] {
  const scope = [categoryId, ...descendantCategoryIds(categoryId, data.categories)];
  const seen = new Set<number>();
  const out: Item[] = [];
  for (const catId of scope) {
    for (const item of itemsForCategoryDirect(catId, data)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

export function descendantCategoryIds(rootId: number, categories: Category[]): number[] {
  const out: number[] = [];
  const walk = (parentId: number) => {
    for (const c of categories) {
      if (c.parentCategoryId === parentId) {
        out.push(c.id);
        walk(c.id);
      }
    }
  };
  walk(rootId);
  return out;
}

export function modifiersForItem(itemId: number, data: BulkData): Modifier[] {
  return data.itemModifiers
    .filter((im) => im.itemId === itemId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((im) => data.modifiers.find((m) => m.id === im.modifierId))
    .filter((m): m is Modifier => m !== undefined);
}

/** Direct nested child modifiers of one modifier (one level).
 *  Primary: the parent's explicit `modifierIds` CSV. Fallback: children that
 *  declare this as their `parentModifierId` — Excel exports populate the child's
 *  parentModifierId but often leave the parent's modifierIds empty. */
export function nestedModifiersFor(parentModifierId: number, data: BulkData): Modifier[] {
  const parent = data.modifiers.find((m) => m.id === parentModifierId);
  const explicit = parseCsvIds(parent?.modifierIds)
    .map((id) => data.modifiers.find((m) => m.id === id))
    .filter((m): m is Modifier => m !== undefined);
  if (explicit.length > 0) return explicit;
  return data.modifiers.filter((m) => m.parentModifierId === parentModifierId);
}

export function optionsForModifier(
  modifierId: number,
  data: BulkData,
): { option: ModifierOption; join: ModifierModifierOption }[] {
  return data.modifierModifierOptions
    .filter((mmo) => mmo.modifierId === modifierId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((join) => {
      const option = data.modifierOptions.find((o) => o.id === join.modifierOptionId);
      return option ? { option, join } : null;
    })
    .filter((x): x is { option: ModifierOption; join: ModifierModifierOption } => x !== null);
}

// ---------------------------------------------------------------------------
// Cascade resolver
// ---------------------------------------------------------------------------

function collectClosure(level: BulkLevel, id: number, data: BulkData, acc: BulkTargets): void {
  switch (level) {
    case 'menu': {
      if (acc.menuIds.has(id)) return;
      acc.menuIds.add(id);
      rootCategoriesForMenu(id, data.categories).forEach((c) =>
        collectClosure('category', c.id, data, acc),
      );
      return;
    }
    case 'category': {
      if (acc.categoryIds.has(id)) return;
      acc.categoryIds.add(id);
      subcategoriesOf(id, data.categories).forEach((c) =>
        collectClosure('category', c.id, data, acc),
      );
      itemsForCategoryDirect(id, data).forEach((i) => collectClosure('item', i.id, data, acc));
      return;
    }
    case 'item': {
      if (acc.itemIds.has(id)) return;
      acc.itemIds.add(id);
      modifiersForItem(id, data).forEach((m) => collectClosure('modifier', m.id, data, acc));
      return;
    }
    case 'modifier': {
      if (acc.modifierIds.has(id)) return;
      acc.modifierIds.add(id);
      for (const { option, join } of optionsForModifier(id, data)) {
        acc.optionIds.add(option.id);
        acc.pairKeys.add(`${join.modifierId}:${join.modifierOptionId}`);
      }
      // Nested modifiers cascade too (guarded against cycles by the has() check)
      nestedModifiersFor(id, data).forEach((nested) =>
        collectClosure('modifier', nested.id, data, acc),
      );
      return;
    }
    case 'option': {
      acc.optionIds.add(id);
      return;
    }
  }
}

/** Resolve a selection (set of "level:id" keys) to the full cascade of targets. */
export function resolveTargets(selected: Set<string>, data: BulkData): BulkTargets {
  const acc = emptyTargets();
  for (const key of selected) {
    const [level, idStr] = key.split(':');
    collectClosure(level as BulkLevel, parseInt(idStr, 10), data, acc);
  }
  // Directly-selected options: surcharge edits apply to every join that uses them
  for (const key of selected) {
    const [level, idStr] = key.split(':');
    if (level !== 'option') continue;
    const optionId = parseInt(idStr, 10);
    data.modifierModifierOptions
      .filter((mmo) => mmo.modifierOptionId === optionId)
      .forEach((mmo) => acc.pairKeys.add(`${mmo.modifierId}:${mmo.modifierOptionId}`));
  }
  return acc;
}

function closureKeys(level: BulkLevel, id: number, data: BulkData): Set<string> {
  const acc = emptyTargets();
  collectClosure(level, id, data, acc);
  const keys = new Set<string>();
  acc.menuIds.forEach((x) => keys.add(bulkKey('menu', x)));
  acc.categoryIds.forEach((x) => keys.add(bulkKey('category', x)));
  acc.itemIds.forEach((x) => keys.add(bulkKey('item', x)));
  acc.modifierIds.forEach((x) => keys.add(bulkKey('modifier', x)));
  acc.optionIds.forEach((x) => keys.add(bulkKey('option', x)));
  return keys;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface DrillPath {
  menuId: number | null;
  categoryId: number | null;
  itemId: number | null;
  modifierId: number | null;
  nestedModifierId: number | null;
}

const EMPTY_DRILL: DrillPath = {
  menuId: null,
  categoryId: null,
  itemId: null,
  modifierId: null,
  nestedModifierId: null,
};

export function useBulkSelection() {
  const categories = useMenuStore((s) => s.categories);
  const items = useMenuStore((s) => s.items);
  const modifiers = useMenuStore((s) => s.modifiers);
  const modifierOptions = useMenuStore((s) => s.modifierOptions);
  const categoryItems = useMenuStore((s) => s.categoryItems);
  const itemModifiers = useMenuStore((s) => s.itemModifiers);
  const modifierModifierOptions = useMenuStore((s) => s.modifierModifierOptions);

  const data: BulkData = useMemo(
    () => ({
      categories,
      items,
      modifiers,
      modifierOptions,
      categoryItems,
      itemModifiers,
      modifierModifierOptions,
    }),
    [categories, items, modifiers, modifierOptions, categoryItems, itemModifiers, modifierModifierOptions],
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<DrillPath>(EMPTY_DRILL);

  const targets = useMemo(() => resolveTargets(selected, data), [selected, data]);

  /** Toggle one node. Overlapping ancestor/descendant selections are allowed —
   *  resolveTargets de-dupes with Sets, so nothing is ever double-applied,
   *  and keeping parents checked is what makes child columns show unions. */
  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  /** Column header select-all: select every given key, or clear them all if
   *  every one is already selected. */
  const toggleAll = useCallback((keys: string[]) => {
    setSelected((prev) => {
      const allSelected = keys.length > 0 && keys.every((k) => prev.has(k));
      const next = new Set(prev);
      keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  }, []);

  /** Ids of directly-selected nodes at one level (drives column unions). */
  const selectedIdsAt = useCallback(
    (level: BulkLevel): number[] =>
      [...selected]
        .filter((k) => k.startsWith(level + ':'))
        .map((k) => parseInt(k.split(':')[1], 10)),
    [selected],
  );

  /** "modifierId:optionId" join keys for the given option ids — option
   *  surcharge lives on the join (maxLimit), so bulk price edits target these. */
  const optionPairKeys = useCallback(
    (optionIds: number[]): string[] => {
      const want = new Set(optionIds);
      return data.modifierModifierOptions
        .filter((mmo) => want.has(mmo.modifierOptionId))
        .map((mmo) => `${mmo.modifierId}:${mmo.modifierOptionId}`);
    },
    [data],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  /** Is any descendant of this node selected? (drives indeterminate checkboxes) */
  const isIndeterminate = useCallback(
    (key: string) => {
      if (selected.size === 0 || selected.has(key)) return false;
      const [level, idStr] = key.split(':');
      const closure = closureKeys(level as BulkLevel, parseInt(idStr, 10), data);
      for (const k of selected) {
        if (k !== key && closure.has(k)) return true;
      }
      return false;
    },
    [selected, data],
  );

  /** Is this node reached by the current selection's cascade (without being
   *  directly selected)? Used to tint rows that a bulk edit will touch. */
  const isCascadeTarget = useCallback(
    (key: string) => {
      if (selected.has(key)) return false;
      const [level, idStr] = key.split(':');
      const id = parseInt(idStr, 10);
      switch (level as BulkLevel) {
        case 'menu': return targets.menuIds.has(id);
        case 'category': return targets.categoryIds.has(id);
        case 'item': return targets.itemIds.has(id);
        case 'modifier': return targets.modifierIds.has(id);
        case 'option': return targets.optionIds.has(id);
      }
    },
    [selected, targets],
  );

  const drillTo = useCallback((level: BulkLevel | 'nestedModifier', id: number | null) => {
    setDrill((prev) => {
      switch (level) {
        case 'menu':
          return { menuId: prev.menuId === id ? null : id, categoryId: null, itemId: null, modifierId: null, nestedModifierId: null };
        case 'category':
          return { ...prev, categoryId: prev.categoryId === id ? null : id, itemId: null, modifierId: null, nestedModifierId: null };
        case 'item':
          return { ...prev, itemId: prev.itemId === id ? null : id, modifierId: null, nestedModifierId: null };
        case 'modifier':
          return { ...prev, modifierId: prev.modifierId === id ? null : id, nestedModifierId: null };
        case 'nestedModifier':
          return { ...prev, nestedModifierId: prev.nestedModifierId === id ? null : id };
        default:
          return prev;
      }
    });
  }, []);

  return {
    data,
    selected,
    targets,
    drill,
    toggle,
    toggleAll,
    selectedIdsAt,
    optionPairKeys,
    clear,
    isIndeterminate,
    isCascadeTarget,
    drillTo,
  };
}
