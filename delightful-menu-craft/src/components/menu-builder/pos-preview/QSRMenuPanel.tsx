import { useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import type { Item } from '@/types/menu';
import { POS_TILE_HEIGHT, POS_TILE_WIDTH } from './posTileStyles';

interface QSRMenuPanelProps {
  onAddToTicket: (item: Item) => void;
}

export function QSRMenuPanel({ onAddToTicket }: QSRMenuPanelProps) {
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
        .filter((i): i is Item => i !== undefined);

      const subcatSections = subcats
        .map((sub) => {
          const subItems = categoryItems
            .filter((ci) => ci.categoryId === sub.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((ci) => items.find((i) => i.id === ci.itemId))
            .filter((i): i is Item => i !== undefined);
          return { subcategory: sub, items: subItems };
        })
        .filter((s) => s.items.length > 0);

      return { category: cat, directItems, subcatSections };
    });
  }, [rootCategories, categories, categoryItems, items]);

  return (
    <div className="flex gap-3 h-full min-h-[200px]">
      {menuColumns.map(({ category, directItems, subcatSections }) => {
        const accent = category.color || '#f97316';
        const allEmpty = directItems.length === 0 && subcatSections.length === 0;
        return (
          <div
            key={category.id}
            className={`flex flex-col gap-2 ${POS_TILE_WIDTH} h-full min-h-0`}
          >
            {/* Category header — same tile size as item buttons */}
            <div
              className={`w-full ${POS_TILE_HEIGHT} rounded-lg flex items-center justify-center px-2 text-center text-xs font-semibold text-white shadow-sm shrink-0 leading-tight`}
              style={{ backgroundColor: accent }}
            >
              {category.posDisplayName || category.categoryName}
            </div>

            {/* Items + subcategory sections */}
            <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-0.5">
              {directItems.map((item) => (
                <ItemTile key={item.id} item={item} accent={accent} onClick={() => onAddToTicket(item)} />
              ))}

              {subcatSections.map(({ subcategory, items: subItems }) => (
                <div key={subcategory.id} className="mt-1">
                  <div
                    className={`w-full ${POS_TILE_HEIGHT} rounded-lg flex items-center justify-center px-2 text-[9px] font-semibold uppercase tracking-wider text-white/90 mb-1 text-center leading-tight line-clamp-3`}
                    style={{ backgroundColor: subcategory.color || accent }}
                  >
                    {subcategory.posDisplayName || subcategory.categoryName}
                  </div>
                  {subItems.map((item) => (
                    <div key={item.id} className="mb-1.5">
                      <ItemTile
                        item={item}
                        accent={subcategory.color || accent}
                        onClick={() => onAddToTicket(item)}
                      />
                    </div>
                  ))}
                </div>
              ))}

              {allEmpty && (
                <p className="text-[10px] text-zinc-600 text-center py-4">Empty</p>
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
        `w-full ${POS_TILE_HEIGHT} rounded-lg box-border flex flex-col items-stretch justify-between px-2.5 py-2.5 text-left transition-colors`,
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
