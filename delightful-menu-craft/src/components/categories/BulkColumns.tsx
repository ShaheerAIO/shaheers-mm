import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import type { Category, Item, Modifier, ModifierModifierOption, ModifierOption } from '@/types/menu';
import { BulkColumn, type BulkRowData } from './BulkColumn';
import {
  bulkKey,
  parseCsvIds,
  LEVEL_COLORS,
  categoriesForMenuFlat,
  itemsForCategoryScope,
  modifiersForItem,
  optionsForModifier,
  type useBulkSelection,
} from './useBulkSelection';

type BulkSelection = ReturnType<typeof useBulkSelection>;

export interface BulkFilters {
  stock: 'all' | 'in' | 'out';
  stationId: number | null;
  tagId: number | null;
  allergenId: number | null;
}

export const EMPTY_FILTERS: BulkFilters = {
  stock: 'all',
  stationId: null,
  tagId: null,
  allergenId: null,
};

interface BulkColumnsProps {
  selection: BulkSelection;
  search: string;
  filters: BulkFilters;
}

// ---------------------------------------------------------------------------
// Inline editors (stop propagation so they don't trigger drill)
// ---------------------------------------------------------------------------

function InlinePrice({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(value.toFixed(2));
  const commit = () => {
    const n = parseFloat(draft);
    if (isNaN(n) || n < 0 || n === value) { setDraft(value.toFixed(2)); return; }
    onCommit(Math.round(n * 100) / 100);
  };
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      <span className="text-muted-foreground text-[10px]">$</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-16 h-6 px-1 text-xs text-right tabular-nums bg-transparent border border-transparent rounded hover:border-border focus:border-primary/50 focus:bg-background outline-none transition-colors"
      />
    </span>
  );
}

function InlineStock({ inStock, onToggle }: { inStock: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title="Click to toggle stock"
      className={cn(
        'inline-block text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 transition-colors',
        inStock
          ? 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
          : 'bg-destructive/10 text-destructive hover:bg-destructive/20',
      )}
    >
      {inStock ? 'In' : '86'}
    </button>
  );
}

/** Plain name that becomes an input on double-click. */
function InlineName({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <span
        className="flex-1 truncate font-medium text-foreground"
        title="Double-click to rename"
        onDoubleClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      >
        {value}
      </span>
    );
  }
  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
  };
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="flex-1 min-w-0 h-6 px-1 text-xs font-medium bg-background border border-primary/50 rounded outline-none"
    />
  );
}

const countTag = (n: number, noun: string) => (
  <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
    {n} {noun}
  </span>
);

// ---------------------------------------------------------------------------

export function BulkColumns({ selection, search, filters }: BulkColumnsProps) {
  const menus = useMenuStore((s) => s.menus);
  const updateItem = useMenuStore((s) => s.updateItem);
  const updateModifierOption = useMenuStore((s) => s.updateModifierOption);
  const updateModifierModifierOption = useMenuStore((s) => s.updateModifierModifierOption);
  const {
    data, drill, selected, toggle, toggleAll, selectedIdsAt,
    isIndeterminate, isCascadeTarget, drillTo,
  } = selection;

  const q = search.trim().toLowerCase();
  const filtersActive =
    filters.stock !== 'all' || filters.stationId != null || filters.tagId != null || filters.allergenId != null;

  // Active parents per level: every checked node plus the drilled (opened) one.
  // Child columns show the UNION of all their children, so selecting
  // Appetizers + Pizza + Pasta lists all their items together.
  const activeParents = (level: 'menu' | 'category' | 'item' | 'modifier', drilledId: number | null): number[] => {
    const ids = selectedIdsAt(level);
    if (drilledId != null && !ids.includes(drilledId)) ids.push(drilledId);
    return ids;
  };
  const activeMenuIds = activeParents('menu', drill.menuId);
  const activeCategoryIds = activeParents('category', drill.categoryId);
  const activeItemIds = activeParents('item', drill.itemId);
  const activeModifierIds = activeParents('modifier', drill.modifierId);

  // ---- Item/option attribute filters (parents pass when any descendant does) ----
  const itemFilterPass = (item: Item): boolean => {
    if (filters.stock === 'in' && item.stockStatus === 'outOfStock') return false;
    if (filters.stock === 'out' && item.stockStatus !== 'outOfStock') return false;
    if (filters.stationId != null && !parseCsvIds(item.stationIds).includes(filters.stationId)) return false;
    if (filters.tagId != null && !parseCsvIds(item.tagIds).includes(filters.tagId)) return false;
    if (filters.allergenId != null && !parseCsvIds(item.allergenIds).includes(filters.allergenId)) return false;
    return true;
  };
  const catFilterPass = (catId: number): boolean =>
    !filtersActive || itemsForCategoryScope(catId, data).some(itemFilterPass);
  const menuFilterPass = (menuId: number): boolean =>
    !filtersActive ||
    categoriesForMenuFlat(menuId, data.categories).some(({ category }) => catFilterPass(category.id));
  const optionFilterPass = (inStock: boolean): boolean => {
    if (filters.stock === 'in') return inStock;
    if (filters.stock === 'out') return !inStock;
    return true;
  };

  // A row passes search if its own name matches or any descendant name does,
  // so drilling into a matched parent still works (mockup behavior).
  const nameMatches = (name: string) => !q || name.toLowerCase().includes(q);
  const anyDescendantMatches = useMemo(() => {
    if (!q) return () => true;
    const itemMatches = (itemId: number): boolean => {
      const item = data.items.find((i) => i.id === itemId);
      if (item && nameMatches(item.itemName)) return true;
      return modifiersForItem(itemId, data).some((m) => modMatches(m.id));
    };
    const modMatches = (modId: number): boolean => {
      const mod = data.modifiers.find((m) => m.id === modId);
      if (mod && nameMatches(mod.modifierName)) return true;
      return optionsForModifier(modId, data).some(({ option }) => nameMatches(option.optionName));
    };
    const catMatches = (catId: number): boolean => {
      const cat = data.categories.find((c) => c.id === catId);
      if (cat && nameMatches(cat.categoryName)) return true;
      return itemsForCategoryScope(catId, data).some((i) => itemMatches(i.id));
    };
    return (level: string, id: number): boolean => {
      switch (level) {
        case 'menu': {
          const menu = menus.find((m) => m.id === id);
          if (menu && nameMatches(menu.menuName)) return true;
          return categoriesForMenuFlat(id, data.categories).some(({ category }) =>
            catMatches(category.id),
          );
        }
        case 'category': return catMatches(id);
        case 'item': return itemMatches(id);
        case 'modifier': return modMatches(id);
        default: return true;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, data, menus]);

  const columnProps = {
    selected,
    isIndeterminate,
    isCascadeTarget,
    onToggle: toggle,
    onToggleAll: toggleAll,
  };

  // ---- Menus ----
  const menuRows: BulkRowData[] = menus
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((m) => anyDescendantMatches('menu', m.id) && menuFilterPass(m.id))
    .map((m) => {
      const catCount = categoriesForMenuFlat(m.id, data.categories).length;
      return {
        key: bulkKey('menu', m.id),
        id: m.id,
        name: m.menuName,
        meta: countTag(catCount, 'cat'),
        drillable: true,
      };
    });

  // ---- Categories under all active menus (union, deduped) ----
  const categoryEntries: { category: Category; depth: number }[] = [];
  {
    const seen = new Set<number>();
    for (const menuId of activeMenuIds) {
      for (const entry of categoriesForMenuFlat(menuId, data.categories)) {
        if (seen.has(entry.category.id)) continue;
        seen.add(entry.category.id);
        categoryEntries.push(entry);
      }
    }
    // Keep directly-selected categories visible even if their menu was unchecked
    for (const id of selectedIdsAt('category')) {
      if (seen.has(id)) continue;
      const category = data.categories.find((c) => c.id === id);
      if (category) { seen.add(id); categoryEntries.push({ category, depth: 0 }); }
    }
  }
  const categoryRows: BulkRowData[] = categoryEntries
    .filter(
      ({ category }) =>
        anyDescendantMatches('category', category.id) && catFilterPass(category.id),
    )
    .map(({ category, depth }) => ({
      key: bulkKey('category', category.id),
      id: category.id,
      name: category.categoryName,
      color: category.color || undefined,
      depth,
      meta: countTag(itemsForCategoryScope(category.id, data).length, 'items'),
      drillable: true,
    }));

  // ---- Items under all active categories (union, deduped) ----
  const itemEntries: Item[] = [];
  {
    const seen = new Set<number>();
    for (const catId of activeCategoryIds) {
      for (const item of itemsForCategoryScope(catId, data)) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        itemEntries.push(item);
      }
    }
    for (const id of selectedIdsAt('item')) {
      if (seen.has(id)) continue;
      const item = data.items.find((i) => i.id === id);
      if (item) { seen.add(id); itemEntries.push(item); }
    }
  }
  const itemRows: BulkRowData[] = itemEntries
    .filter((i) => anyDescendantMatches('item', i.id) && itemFilterPass(i))
    .map((i) => ({
      key: bulkKey('item', i.id),
      id: i.id,
      name: i.itemName,
      nameNode: (
        <InlineName
          key={`${i.id}:${i.itemName}`}
          value={i.itemName}
          onCommit={(v) => updateItem(i.id, { itemName: v, posDisplayName: v })}
        />
      ),
      meta: (
        <>
          <InlinePrice
            key={`${i.id}:${i.itemPrice}`}
            value={i.itemPrice}
            onCommit={(v) => updateItem(i.id, { itemPrice: v })}
          />
          <InlineStock
            inStock={i.stockStatus !== 'outOfStock'}
            onToggle={() =>
              updateItem(i.id, {
                stockStatus: i.stockStatus === 'outOfStock' ? 'inStock' : 'outOfStock',
              })
            }
          />
        </>
      ),
      drillable: true,
    }));

  // ---- Modifiers of all active items (union, deduped) ----
  const modifierEntries: Modifier[] = [];
  {
    const seen = new Set<number>();
    for (const itemId of activeItemIds) {
      for (const mod of modifiersForItem(itemId, data)) {
        if (seen.has(mod.id)) continue;
        seen.add(mod.id);
        modifierEntries.push(mod);
      }
    }
    for (const id of selectedIdsAt('modifier')) {
      if (seen.has(id)) continue;
      const mod = data.modifiers.find((m) => m.id === id);
      if (mod) { seen.add(id); modifierEntries.push(mod); }
    }
  }
  const modifierRows: BulkRowData[] = modifierEntries
    .filter((m) => anyDescendantMatches('modifier', m.id))
    .map((m) => ({
      key: bulkKey('modifier', m.id),
      id: m.id,
      name: m.modifierName,
      meta: (
        <>
          {m.modType === 'Required' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              Req
            </span>
          )}
          {countTag(optionsForModifier(m.id, data).length, 'opt')}
        </>
      ),
      drillable: true,
    }));

  // ---- Options of all active modifiers (union, deduped) ----
  const optionEntries: { option: ModifierOption; join: ModifierModifierOption | null }[] = [];
  {
    const seen = new Set<number>();
    for (const modId of activeModifierIds) {
      for (const { option, join } of optionsForModifier(modId, data)) {
        if (seen.has(option.id)) continue;
        seen.add(option.id);
        optionEntries.push({ option, join });
      }
    }
    for (const id of selectedIdsAt('option')) {
      if (seen.has(id)) continue;
      const option = data.modifierOptions.find((o) => o.id === id);
      if (!option) continue;
      seen.add(id);
      const join = data.modifierModifierOptions.find((mmo) => mmo.modifierOptionId === id) ?? null;
      optionEntries.push({ option, join });
    }
  }
  const optionRows: BulkRowData[] = optionEntries
    .filter(
      ({ option }) =>
        nameMatches(option.optionName) && optionFilterPass(option.isStockAvailable),
    )
    .map(({ option, join }) => ({
      key: bulkKey('option', option.id),
      id: option.id,
      name: option.optionName,
      meta: (
        <>
          <InlinePrice
            key={`${join?.modifierId ?? 'o'}:${option.id}:${join?.maxLimit ?? option.price ?? 0}`}
            value={join?.maxLimit || option.price || 0}
            onCommit={(v) =>
              join
                ? updateModifierModifierOption(join.modifierId, option.id, { maxLimit: v })
                : updateModifierOption(option.id, { price: v })
            }
          />
          <InlineStock
            inStock={option.isStockAvailable}
            onToggle={() =>
              updateModifierOption(option.id, { isStockAvailable: !option.isStockAvailable })
            }
          />
        </>
      ),
      drillable: false,
    }));

  const showCategories = activeMenuIds.length > 0 || categoryRows.length > 0;
  const showItems = activeCategoryIds.length > 0 || itemRows.length > 0;
  const showModifiers = activeItemIds.length > 0 || modifierRows.length > 0;
  const showOptions = activeModifierIds.length > 0 || optionRows.length > 0;

  return (
    <div className="flex-1 flex overflow-x-auto overflow-y-hidden min-h-0 scrollbar-thin">
      <BulkColumn
        title="Menus"
        accent={LEVEL_COLORS.menu}
        rows={menuRows}
        count={menuRows.length}
        drilledId={drill.menuId}
        onDrill={(id) => drillTo('menu', id)}
        emptyText="No menus"
        widthClass="w-[210px]"
        {...columnProps}
      />
      {showCategories && (
        <BulkColumn
          title="Categories"
          accent={LEVEL_COLORS.category}
          rows={categoryRows}
          count={categoryRows.length}
          drilledId={drill.categoryId}
          onDrill={(id) => drillTo('category', id)}
          emptyText="No categories under the checked menus"
          widthClass="w-[240px]"
          {...columnProps}
        />
      )}
      {showItems && (
        <BulkColumn
          title="Items"
          accent={LEVEL_COLORS.item}
          rows={itemRows}
          count={itemRows.length}
          drilledId={drill.itemId}
          onDrill={(id) => drillTo('item', id)}
          emptyText="No items under the checked categories"
          widthClass="w-[320px]"
          {...columnProps}
        />
      )}
      {showModifiers && (
        <BulkColumn
          title="Modifiers"
          accent={LEVEL_COLORS.modifier}
          rows={modifierRows}
          count={modifierRows.length}
          drilledId={drill.modifierId}
          onDrill={(id) => drillTo('modifier', id)}
          emptyText="No modifiers on the checked items"
          widthClass="w-[260px]"
          {...columnProps}
        />
      )}
      {showOptions && (
        <BulkColumn
          title="Options"
          accent={LEVEL_COLORS.option}
          rows={optionRows}
          count={optionRows.length}
          drilledId={null}
          onDrill={() => {}}
          emptyText="No options in the checked modifiers"
          widthClass="w-[300px]"
          {...columnProps}
        />
      )}
    </div>
  );
}
