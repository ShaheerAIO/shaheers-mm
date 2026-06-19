import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { ShoppingCart } from 'lucide-react';
import type { Item } from '@/types/menu';
import { isVisibleOnChannel } from '@/lib/visibility';
import { KioskItemCard } from './KioskItemCard';

interface KioskMenuScreenProps {
  onSelectItem: (item: Item) => void;
  cartCount: number;
  subtotal: number;
  onViewCart: () => void;
}

/** Kiosk menu screen: horizontal category tabs + image-forward item grid + cart footer. */
export function KioskMenuScreen({ onSelectItem, cartCount, subtotal, onViewCart }: KioskMenuScreenProps) {
  const { categories, items, categoryItems, selectedMenuId } = useMenuStore();
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const rootCategories = useMemo(() => {
    if (!selectedMenuId) return [];
    return categories
      .filter((c) => {
        const menuIdList =
          c.menuIds
            ?.split(',')
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id)) ?? [];
        return (
          menuIdList.includes(selectedMenuId) &&
          !c.parentCategoryId &&
          isVisibleOnChannel(c, 'visibilityKiosk')
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, selectedMenuId]);

  // Default the active tab to the first category; fall back if it disappears.
  const effectiveCategoryId =
    activeCategoryId != null && rootCategories.some((c) => c.id === activeCategoryId)
      ? activeCategoryId
      : rootCategories[0]?.id ?? null;

  const activeItems = useMemo(() => {
    if (effectiveCategoryId == null) return [];
    const cat = rootCategories.find((c) => c.id === effectiveCategoryId);
    if (!cat) return [];

    const subcats = categories
      .filter((c) => c.parentCategoryId === cat.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const resolve = (categoryId: number) =>
      categoryItems
        .filter((ci) => ci.categoryId === categoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ci) => items.find((i) => i.id === ci.itemId))
        .filter((i): i is Item => i !== undefined && isVisibleOnChannel(i, 'visibilityKiosk'));

    const seen = new Set<number>();
    const flat: Item[] = [];
    for (const item of [resolve(cat.id), ...subcats.map((s) => resolve(s.id))].flat()) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        flat.push(item);
      }
    }
    return flat;
  }, [effectiveCategoryId, rootCategories, categories, categoryItems, items]);

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Category tabs */}
      <div className="shrink-0 border-b border-black/5 bg-white px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rootCategories.map((cat) => {
            const isActive = cat.id === effectiveCategoryId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryId(cat.id)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-[#ED7C69] text-white shadow-sm'
                    : 'bg-[#F1F1F1] text-[#6B6B6B] hover:bg-[#E7E7E7]',
                )}
              >
                {cat.posDisplayName || cat.categoryName}
              </button>
            );
          })}
          {rootCategories.length === 0 && (
            <span className="px-1 py-2 text-sm text-[#9A9A9A]">No kiosk-visible categories</span>
          )}
        </div>
      </div>

      {/* Item grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeItems.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[#9A9A9A]">
            No kiosk-visible items in this category
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {activeItems.map((item) => (
              <KioskItemCard key={item.id} item={item} onClick={() => onSelectItem(item)} />
            ))}
          </div>
        )}
      </div>

      {/* Cart footer */}
      <div className="shrink-0 border-t border-black/5 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onViewCart}
          disabled={cartCount === 0}
          className={cn(
            'flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-base font-semibold text-white transition-colors',
            cartCount === 0 ? 'cursor-not-allowed bg-[#D9D9D9]' : 'bg-[#ED7C69] hover:bg-[#E06A55]',
          )}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            View Cart{cartCount > 0 ? ` (${cartCount})` : ''}
          </span>
          <span className="tabular-nums">${subtotal.toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
}
