import { useState, useMemo, useCallback } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import { ChevronRight } from 'lucide-react';
import type { Category, Item } from '@/types/menu';
import { ModifierPanel } from './ModifierPanel';
import { POS_TILE_FRAME } from './posTileStyles';

interface TSRMenuPanelProps {
  onAddToTicket: (item: Item, selectedOptions: Record<number, number[]>, qty: number) => void;
}

type DrillLevel = 'categories' | 'subcategories' | 'items' | 'modifiers';

export function TSRMenuPanel({ onAddToTicket }: TSRMenuPanelProps) {
  const { categories, items, categoryItems, selectedMenuId, itemModifiers } = useMenuStore();

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);

  const rootCategories = useMemo(() => {
    if (!selectedMenuId) return [];
    return categories
      .filter((c) => {
        const menuIdList =
          c.menuIds
            ?.split(',')
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id)) ?? [];
        return menuIdList.includes(selectedMenuId) && !c.parentCategoryId;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, selectedMenuId]);

  const subcategories = useMemo(() => {
    if (!activeCategoryId) return [];
    return categories
      .filter((c) => c.parentCategoryId === activeCategoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, activeCategoryId]);

  const activeCategory = rootCategories.find((c) => c.id === activeCategoryId) ?? null;
  const activeSubcategory = subcategories.find((c) => c.id === activeSubcategoryId) ?? null;

  /** Items linked directly to the root category (not under a subcategory). */
  const directRootItems = useMemo(() => {
    if (!activeCategoryId) return [];
    const rows = categoryItems
      .filter((ci) => ci.categoryId === activeCategoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const seen = new Set<number>();
    const ordered: Item[] = [];
    for (const ci of rows) {
      if (seen.has(ci.itemId)) continue;
      seen.add(ci.itemId);
      const item = items.find((i) => i.id === ci.itemId);
      if (item) ordered.push(item);
    }
    return ordered;
  }, [activeCategoryId, categoryItems, items]);

  const getItemsForCategoryId = useCallback(
    (categoryId: number): Item[] => {
      const rows = categoryItems
        .filter((ci) => ci.categoryId === categoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const seen = new Set<number>();
      const ordered: Item[] = [];
      for (const ci of rows) {
        if (seen.has(ci.itemId)) continue;
        seen.add(ci.itemId);
        const item = items.find((i) => i.id === ci.itemId);
        if (item) ordered.push(item);
      }
      return ordered;
    },
    [categoryItems, items],
  );

  /** Category with no subcategories: items shown as the only grid. */
  const currentItemsNoSubcats = useMemo(() => {
    if (!activeCategoryId || subcategories.length > 0) return [];
    return getItemsForCategoryId(activeCategoryId);
  }, [activeCategoryId, subcategories.length, getItemsForCategoryId]);

  const level: DrillLevel = useMemo(() => {
    if (activeItemId) return 'modifiers';
    if (activeCategoryId) {
      if (subcategories.length > 0) return 'subcategories';
      return 'items';
    }
    return 'categories';
  }, [activeItemId, activeCategoryId, subcategories.length]);

  const activeItem = items.find((i) => i.id === activeItemId) ?? null;
  const accentColor = activeSubcategory?.color || activeCategory?.color || '#f97316';

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick: () => void }[] = [];
    if (activeCategory) {
      crumbs.push({
        label: activeCategory.posDisplayName || activeCategory.categoryName,
        onClick: () => {
          setActiveSubcategoryId(null);
          setActiveItemId(null);
          if (subcategories.length === 0) setActiveCategoryId(null);
        },
      });
    }
    if (activeSubcategory) {
      crumbs.push({
        label: activeSubcategory.posDisplayName || activeSubcategory.categoryName,
        onClick: () => {
          setActiveItemId(null);
          setActiveSubcategoryId(null);
        },
      });
    }
    if (activeItem) {
      crumbs.push({
        label: activeItem.posDisplayName || activeItem.itemName,
        onClick: () => {},
      });
    }
    return crumbs;
  }, [activeCategory, activeSubcategory, activeItem, subcategories.length]);

  const handleBack = () => {
    if (activeItemId) {
      setActiveItemId(null);
    } else if (activeSubcategoryId) {
      setActiveSubcategoryId(null);
    } else {
      setActiveCategoryId(null);
    }
  };

  const handleCategoryClick = (cat: Category) => {
    setActiveCategoryId(cat.id);
    setActiveSubcategoryId(null);
    setActiveItemId(null);
  };

  /** Toggle expand: items stay under the subcategory button; click again to collapse. */
  const handleSubcategoryClick = (subId: number) => {
    setActiveSubcategoryId((prev) => (prev === subId ? null : subId));
    setActiveItemId(null);
  };

  const handleItemClick = (item: Item) => {
    const hasModifiers = itemModifiers.some((im) => im.itemId === item.id);
    if (!hasModifiers) {
      onAddToTicket(item, {}, 1);
      return;
    }
    setActiveItemId(item.id);
  };

  const handleDone = (item: Item, opts: Record<number, number[]>, qty: number) => {
    onAddToTicket(item, opts, qty);
    setActiveItemId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Breadcrumb / back bar */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800/60 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={handleBack}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap shrink-0"
          >
            ← Back
          </button>
          <span className="text-zinc-700 mx-1 shrink-0">|</span>
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} className="flex items-center gap-1 min-w-0 shrink-0">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-zinc-700 shrink-0" />}
              <button
                type="button"
                onClick={crumb.onClick}
                className={cn(
                  'text-[11px] transition-colors truncate max-w-[120px]',
                  idx === breadcrumbs.length - 1
                    ? 'text-zinc-300 font-semibold cursor-default'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Content area — top-aligned so subcategory buttons stay above their items */}
      <div
        className={cn(
          'flex-1 min-h-0 flex flex-col justify-start',
          level !== 'modifiers' && 'overflow-y-auto p-3',
        )}
      >
        {/* Level: categories */}
        {level === 'categories' && (
          <div className="flex flex-wrap gap-2">
            {rootCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`${POS_TILE_FRAME} flex items-center justify-center px-2 text-center text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.97]`}
                style={{ backgroundColor: cat.color || '#f97316' }}
              >
                <span className="line-clamp-2 leading-tight px-0.5">
                  {cat.posDisplayName || cat.categoryName}
                </span>
              </button>
            ))}
            {rootCategories.length === 0 && (
              <p className="w-full text-center text-zinc-600 text-sm py-8">
                No categories in this menu
              </p>
            )}
          </div>
        )}

        {/* Level: subcategories — subcategory buttons on top; items stack underneath (not above) */}
        {level === 'subcategories' && (
          <div className="flex flex-col gap-4 w-full min-w-0 items-stretch">
            {subcategories.map((cat) => {
              const subAccent = cat.color || accentColor;
              const expanded = activeSubcategoryId === cat.id;
              const subItems = getItemsForCategoryId(cat.id);
              return (
                <div key={cat.id} className="flex flex-col gap-2 min-w-0 items-start">
                  <button
                    type="button"
                    onClick={() => handleSubcategoryClick(cat.id)}
                    className={cn(
                      `${POS_TILE_FRAME} flex items-center justify-center px-2 text-center text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.97]`,
                      expanded &&
                        'ring-2 ring-white/50 ring-offset-2 ring-offset-[hsl(var(--pos-shell))]',
                    )}
                    style={{ backgroundColor: subAccent }}
                  >
                    <span className="line-clamp-2 leading-tight px-0.5">
                      {cat.posDisplayName || cat.categoryName}
                    </span>
                  </button>
                  {expanded && (
                    <div className="flex flex-col gap-2 w-full max-w-full pl-2 sm:pl-3 ml-0.5 sm:ml-1 border-l-2 border-zinc-600/70 pt-1 pb-1">
                      {subItems.map((item) => (
                        <ItemTileButton
                          key={item.id}
                          item={item}
                          accentColor={subAccent}
                          onPick={() => handleItemClick(item)}
                        />
                      ))}
                      {subItems.length === 0 && (
                        <p className="w-full text-zinc-600 text-xs py-2">No items in this subcategory</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {directRootItems.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-0.5">
                  {activeCategory?.posDisplayName || activeCategory?.categoryName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {directRootItems.map((item) => (
                    <ItemTileButton
                      key={item.id}
                      item={item}
                      accentColor={activeCategory?.color || '#f97316'}
                      onPick={() => handleItemClick(item)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Level: items (category has no subcategories) */}
        {level === 'items' && (
          <div className="flex flex-wrap gap-2">
            {currentItemsNoSubcats.map((item) => (
              <ItemTileButton
                key={item.id}
                item={item}
                accentColor={accentColor}
                onPick={() => handleItemClick(item)}
              />
            ))}
            {currentItemsNoSubcats.length === 0 && (
              <p className="w-full text-center text-zinc-600 text-sm py-8">No items</p>
            )}
          </div>
        )}

        {/* Level: modifiers */}
        {level === 'modifiers' && activeItem && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ModifierPanel
              item={activeItem}
              categoryColor={accentColor}
              onDone={handleDone}
              onCancel={() => setActiveItemId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ItemTileButton({
  item,
  accentColor,
  onPick,
}: {
  item: Item;
  accentColor: string;
  onPick: () => void;
}) {
  const unavailable = item.stockStatus !== 'inStock';
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        `${POS_TILE_FRAME} flex flex-col items-stretch justify-between px-3 py-2.5 text-left transition-all`,
        'bg-[hsl(var(--pos-menu-tile))] border border-zinc-700/80',
        'hover:border-zinc-500 hover:bg-zinc-800/80 active:scale-[0.97]',
        unavailable && 'opacity-45 border-red-900/50 cursor-not-allowed',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
      disabled={unavailable}
    >
      <span
        className={cn(
          'text-sm font-medium leading-snug text-zinc-100 line-clamp-2',
          unavailable && 'line-through',
        )}
      >
        {shortenName(item.posDisplayName || item.itemName)}
      </span>
      <span className="text-xs font-semibold text-[hsl(var(--pos-accent-muted))] tabular-nums shrink-0">
        ${item.itemPrice.toFixed(2)}
      </span>
    </button>
  );
}
