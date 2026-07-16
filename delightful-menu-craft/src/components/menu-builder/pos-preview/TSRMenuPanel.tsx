import { useState, useMemo, useCallback } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import { ChevronRight, UtensilsCrossed } from 'lucide-react';
import type { Category, Item, PizzaSide } from '@/types/menu';
import { ModifierPanel, itemHasPopupModifiers } from './ModifierPanel';
import { POS_TILE_FRAME } from './posTileStyles';
import { isAvailableOnChannelAt } from '@/lib/visibility';

interface TSRMenuPanelProps {
  onAddToTicket: (
    item: Item,
    selectedOptions: Record<number, number[]>,
    qty: number,
    pizzaSides?: Record<number, PizzaSide>,
  ) => void;
  onTicketBlockChange?: (blocked: boolean) => void;
  searchQuery?: string;
  /** When true, categories/subcategories/items render as image row cards. */
  imageMode?: boolean;
}

type DrillLevel = 'categories' | 'subcategories' | 'items' | 'modifiers';

/** Fixed 16:9-ish image-mode card: image on the left, name on the right. */
const IMAGE_CARD_FRAME = 'w-[210px] h-[118px] shrink-0';

export function TSRMenuPanel({ onAddToTicket, onTicketBlockChange, searchQuery = '', imageMode = false }: TSRMenuPanelProps) {
  const {
    categories,
    items,
    categoryItems,
    selectedMenuId,
    itemModifiers,
    modifiers,
    modifierModifierOptions,
    modifierOptions,
  } = useMenuStore();

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
      if (item && isAvailableOnChannelAt(item, 'visibilityPos')) ordered.push(item);
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
        if (item && isAvailableOnChannelAt(item, 'visibilityPos')) ordered.push(item);
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

  // Flat list of all POS-visible items in the selected menu, for search
  const allMenuItems = useMemo(() => {
    if (!selectedMenuId) return [];
    const menuCatIds = new Set(
      categories
        .filter((c) => {
          const ids = c.menuIds?.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id)) ?? [];
          return ids.includes(selectedMenuId);
        })
        .map((c) => c.id),
    );
    const seen = new Set<number>();
    const result: Array<{ item: Item; categoryName: string; accentColor: string }> = [];
    for (const ci of [...categoryItems].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (!menuCatIds.has(ci.categoryId)) continue;
      if (seen.has(ci.itemId)) continue;
      seen.add(ci.itemId);
      const item = items.find((i) => i.id === ci.itemId);
      if (!item || !isAvailableOnChannelAt(item, 'visibilityPos')) continue;
      const cat = categories.find((c) => c.id === ci.categoryId);
      result.push({
        item,
        categoryName: cat?.posDisplayName || cat?.categoryName || '',
        accentColor: cat?.color || '#f97316',
      });
    }
    return result;
  }, [selectedMenuId, categories, categoryItems, items]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allMenuItems.filter(
      ({ item }) =>
        item.itemName.toLowerCase().includes(q) ||
        (item.posDisplayName || '').toLowerCase().includes(q),
    );
  }, [allMenuItems, searchQuery]);

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
    if (
      !itemHasPopupModifiers(
        item.id,
        itemModifiers,
        modifiers,
        modifierModifierOptions,
        modifierOptions,
      )
    ) {
      onAddToTicket(item, {}, 1);
      return;
    }
    setActiveItemId(item.id);
  };

  const handleDone = (item: Item, opts: Record<number, number[]>, qty: number, sides: Record<number, PizzaSide>) => {
    onAddToTicket(item, opts, qty, sides);
    setActiveItemId(null);
  };

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Breadcrumb / back bar — hidden during search */}
      {breadcrumbs.length > 0 && !isSearchActive && (
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

      {/* Search results — override drill-down when query is active (modifier panel still takes priority) */}
      {isSearchActive && !activeItemId ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
          {searchResults.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-8">No items match "{searchQuery}"</p>
          ) : (
            searchResults.map(({ item, categoryName, accentColor: accent }) => {
              const unavailable = item.stockStatus !== 'inStock';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  disabled={unavailable}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                    'bg-[hsl(var(--pos-menu-tile))] border border-zinc-700/80',
                    'hover:border-zinc-500 hover:bg-zinc-800/80 active:scale-[0.98]',
                    unavailable && 'opacity-45 cursor-not-allowed',
                  )}
                  style={{ borderLeftWidth: 3, borderLeftColor: accent }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {imageMode && <Thumb image={item.itemPicture} name={item.itemName} />}
                  <div className="min-w-0">
                    <div className={cn('text-sm font-medium text-zinc-100 truncate', unavailable && 'line-through')}>
                      {item.posDisplayName || item.itemName}
                    </div>
                    {categoryName && (
                      <div className="text-[10px] text-zinc-500 truncate">{categoryName}</div>
                    )}
                  </div>
                  </div>
                  <span className="text-xs font-semibold text-[hsl(var(--pos-accent-muted))] tabular-nums shrink-0">
                    ${item.itemPrice.toFixed(2)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : (
      /* Content area — top-aligned so subcategory buttons stay above their items */
      <div
        className={cn(
          'flex-1 min-h-0 flex flex-col justify-start',
          level !== 'modifiers' && 'overflow-y-auto p-3',
        )}
      >
        {/* Level: categories */}
        {level === 'categories' && (
          imageMode ? (
            <div className="flex flex-wrap gap-2.5">
              {rootCategories.map((cat) => (
                <CategoryImageCard
                  key={cat.id}
                  name={cat.posDisplayName || cat.categoryName}
                  color={cat.color || '#f97316'}
                  image={cat.image}
                  onClick={() => handleCategoryClick(cat)}
                />
              ))}
              {rootCategories.length === 0 && (
                <p className="w-full text-center text-zinc-600 text-sm py-8">
                  No categories in this menu
                </p>
              )}
            </div>
          ) : (
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
          )
        )}

        {/* Level: subcategories — subcategory buttons on top; items stack underneath (not above) */}
        {level === 'subcategories' && (
          <div className="flex flex-col gap-4 w-full min-w-0 items-stretch">
            {subcategories.map((cat) => {
              const subAccent = cat.color || accentColor;
              const expanded = activeSubcategoryId === cat.id;
              const subItems = getItemsForCategoryId(cat.id);
              return (
                <div key={cat.id} className={cn('flex flex-col gap-2 min-w-0', imageMode ? 'items-stretch' : 'items-start')}>
                  {imageMode ? (
                    <CategoryImageCard
                      name={cat.posDisplayName || cat.categoryName}
                      color={subAccent}
                      image={cat.image}
                      expanded={expanded}
                      onClick={() => handleSubcategoryClick(cat.id)}
                    />
                  ) : (
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
                  )}
                  {expanded && (
                    imageMode ? (
                      <div className="flex flex-wrap gap-2.5 w-full max-w-full pl-2 sm:pl-3 ml-0.5 sm:ml-1 border-l-2 border-zinc-600/70 pt-1 pb-1">
                        {subItems.map((item) => (
                          <ItemTileButton
                            key={item.id}
                            item={item}
                            accentColor={subAccent}
                            onPick={() => handleItemClick(item)}
                            imageMode
                          />
                        ))}
                        {subItems.length === 0 && (
                          <p className="w-full text-zinc-600 text-xs py-2">No items in this subcategory</p>
                        )}
                      </div>
                    ) : (
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
                    )
                  )}
                </div>
              );
            })}

            {directRootItems.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-0.5">
                  {activeCategory?.posDisplayName || activeCategory?.categoryName}
                </p>
                <div className={cn('flex flex-wrap', imageMode ? 'gap-2.5' : 'gap-2')}>
                  {directRootItems.map((item) => (
                    <ItemTileButton
                      key={item.id}
                      item={item}
                      accentColor={activeCategory?.color || '#f97316'}
                      onPick={() => handleItemClick(item)}
                      imageMode={imageMode}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Level: items (category has no subcategories) */}
        {level === 'items' && (
          <div className={cn('flex flex-wrap', imageMode ? 'gap-2.5' : 'gap-2')}>
            {currentItemsNoSubcats.map((item) => (
              <ItemTileButton
                key={item.id}
                item={item}
                accentColor={accentColor}
                onPick={() => handleItemClick(item)}
                imageMode={imageMode}
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
              onTicketBlockChange={onTicketBlockChange}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function ItemTileButton({
  item,
  accentColor,
  onPick,
  imageMode = false,
}: {
  item: Item;
  accentColor: string;
  onPick: () => void;
  imageMode?: boolean;
}) {
  const unavailable = item.stockStatus !== 'inStock';

  if (imageMode) {
    return (
      <button
        type="button"
        onClick={onPick}
        className={cn(
          `${IMAGE_CARD_FRAME} flex items-stretch rounded-lg overflow-hidden box-border text-left transition-all`,
          'bg-[hsl(var(--pos-menu-tile))] border border-zinc-700/80',
          'hover:border-zinc-500 hover:bg-zinc-800/80 active:scale-[0.98]',
          unavailable && 'opacity-45 border-red-900/50 cursor-not-allowed',
        )}
        style={{ borderLeftWidth: 5, borderLeftColor: accentColor }}
        disabled={unavailable}
      >
        <Thumb image={item.itemPicture} name={item.itemName} tall />
        <div className="flex flex-col min-w-0 flex-1 justify-center gap-1 px-3 py-2">
          <span
            className={cn(
              'text-sm font-medium leading-snug text-zinc-100 line-clamp-3',
              unavailable && 'line-through',
            )}
          >
            {shortenName(item.posDisplayName || item.itemName)}
          </span>
          <span className="text-xs font-semibold text-[hsl(var(--pos-accent-muted))] tabular-nums">
            ${item.itemPrice.toFixed(2)}
          </span>
        </div>
      </button>
    );
  }

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

/** Horizontal category / subcategory card with an image thumbnail (image mode). */
function CategoryImageCard({
  name,
  color,
  image,
  expanded = false,
  onClick,
}: {
  name: string;
  color: string;
  image?: string;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        `${IMAGE_CARD_FRAME} flex items-stretch rounded-lg overflow-hidden box-border text-left transition-all`,
        'bg-[hsl(var(--pos-menu-tile))] border border-zinc-700/80',
        'hover:border-zinc-500 hover:bg-zinc-800/80 active:scale-[0.98]',
        expanded && 'ring-2 ring-white/50',
      )}
      style={{ borderLeftWidth: 5, borderLeftColor: color }}
    >
      <Thumb image={image} name={name} tall />
      <span className="flex-1 flex items-center text-sm font-semibold text-zinc-100 line-clamp-3 leading-tight px-3 py-2">
        {name}
      </span>
    </button>
  );
}

/** Image thumbnail with graceful fallback to a utensils icon. */
function Thumb({ image, name, tall = false }: { image?: string; name: string; tall?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const showImage = image && !imgError;
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden bg-zinc-800',
        tall ? 'h-full w-[120px]' : 'h-11 w-11 rounded-md',
      )}
    >
      {showImage ? (
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-600">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}
