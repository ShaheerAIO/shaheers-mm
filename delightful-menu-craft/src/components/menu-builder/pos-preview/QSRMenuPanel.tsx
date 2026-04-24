import { useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import type { Item } from '@/types/menu';
import { POS_TILE_HEIGHT, POS_TILE_WIDTH } from './posTileStyles';
import { isVisibleOnChannel } from '@/lib/visibility';

interface QSRMenuPanelProps {
  onAddToTicket: (item: Item) => void;
  searchQuery?: string;
}

export function QSRMenuPanel({ onAddToTicket, searchQuery = '' }: QSRMenuPanelProps) {
  const { categories, items, categoryItems, selectedMenuId } = useMenuStore();

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

  const menuColumns = useMemo(() => {
    return rootCategories.map((cat) => {
      const subcats = categories
        .filter((c) => c.parentCategoryId === cat.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const directItems = categoryItems
        .filter((ci) => ci.categoryId === cat.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ci) => items.find((i) => i.id === ci.itemId))
        .filter((i): i is Item => i !== undefined && isVisibleOnChannel(i, 'visibilityPos'));

      const subcatItemsFlat = subcats.flatMap((sub) =>
        categoryItems
          .filter((ci) => ci.categoryId === sub.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((ci) => items.find((i) => i.id === ci.itemId))
          .filter((i): i is Item => i !== undefined && isVisibleOnChannel(i, 'visibilityPos')),
      );

      const seen = new Set<number>();
      const flatItems: Item[] = [];
      for (const item of [...directItems, ...subcatItemsFlat]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          flatItems.push(item);
        }
      }

      return { category: cat, flatItems };
    });
  }, [rootCategories, categories, categoryItems, items]);

  const q = searchQuery.trim().toLowerCase();

  return (
    <div className="flex gap-3 h-full min-h-0">
      {menuColumns.map(({ category, flatItems }) => {
        const accent = category.color || '#f97316';
        const visibleItems = q
          ? flatItems.filter(
              (item) =>
                item.itemName.toLowerCase().includes(q) ||
                (item.posDisplayName || '').toLowerCase().includes(q),
            )
          : flatItems;
        return (
          <div
            key={category.id}
            className="flex flex-col gap-2 h-full min-h-0 max-h-full w-max shrink-0"
          >
            {/* Category header — half tile height; width grows with item columns */}
            <div
              className="w-full min-w-[118px] sm:min-w-[128px] h-[37px] rounded-md flex items-center justify-center px-2 text-center text-[11px] font-semibold text-white shadow-sm shrink-0 leading-tight"
              style={{ backgroundColor: accent }}
            >
              {category.posDisplayName || category.categoryName}
            </div>

            {/* Items flow down then wrap right; column width grows — no inner horizontal scroll */}
            <div
              className={cn(
                'flex flex-1 min-h-0 h-full max-h-full min-w-[118px] sm:min-w-[128px]',
                'flex-col flex-wrap content-start items-start gap-x-2 gap-y-1.5',
                'overflow-x-visible overflow-y-hidden',
              )}
            >
              {visibleItems.map((item) => (
                <ItemTile key={item.id} item={item} accent={accent} onClick={() => onAddToTicket(item)} />
              ))}

              {visibleItems.length === 0 && (
                <p className="text-[10px] text-zinc-600 text-center py-4 w-full min-w-[118px] sm:min-w-[128px]">
                  Empty
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemTile({
  item,
  accent,
  onClick,
}: {
  item: Item;
  accent: string;
  onClick: () => void;
}) {
  const isUnavailable = item.stockStatus !== 'inStock';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isUnavailable}
      className={cn(
        `${POS_TILE_WIDTH} ${POS_TILE_HEIGHT} rounded-lg box-border flex flex-col items-stretch justify-between px-2.5 py-2.5 text-left transition-colors shrink-0`,
        'bg-[hsl(var(--pos-menu-tile))] border border-zinc-700/80',
        'hover:border-zinc-500 hover:bg-zinc-800/80',
        isUnavailable && 'opacity-45 border-red-900/50 cursor-not-allowed',
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <span
        className={cn(
          'text-[12px] font-medium leading-snug text-zinc-100 line-clamp-2',
          isUnavailable && 'line-through',
        )}
      >
        {shortenName(item.posDisplayName || item.itemName)}
      </span>
      <span className="text-[11px] font-semibold text-[hsl(var(--pos-accent-muted))] tabular-nums shrink-0">
        ${item.itemPrice.toFixed(2)}
      </span>
    </button>
  );
}
