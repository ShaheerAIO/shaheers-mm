import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { RotateCcw, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import type { Item } from '@/types/menu';
import { isVisibleOnChannel, isAvailableOnChannelAt } from '@/lib/visibility';
import { collectCategorySubtreeIds } from '@/lib/categoryTree';
import { KioskItemCard } from './KioskItemCard';

interface KioskMenuScreenProps {
  onSelectItem: (item: Item) => void;
  cartCount: number;
  subtotal: number;
  onViewCart: () => void;
  onStartNewOrder: () => void;
}

interface Section {
  categoryId: number;
  name: string;
  image: string;
  items: Item[];
}

/**
 * Kiosk landing: a sticky category tab bar over one continuously-scrolling list.
 * The whole menu is a single vertical scroll — each category is a labeled
 * section stacked in order. Tapping a tab smooth-scrolls to that section, and
 * the active tab tracks the section currently at the top of the scroll area
 * (scrollspy). Mirrors the real kiosk's browse behaviour.
 */
export function KioskMenuScreen({
  onSelectItem,
  cartCount,
  subtotal,
  onViewCart,
  onStartNewOrder,
}: KioskMenuScreenProps) {
  const { menus, categories, items, categoryItems, selectedMenuId, setSelectedMenu } = useMenuStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const tabRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);

  const sortedMenus = useMemo(() => [...menus].sort((a, b) => a.sortOrder - b.sortOrder), [menus]);

  // Root categories of the active menu, kiosk-visible, in sort order.
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

  // One section per root category (its own items + all nested subcategory items
  // at any depth, deduped, gated by kiosk visibility + schedule). Empty sections
  // are dropped.
  const sections = useMemo<Section[]>(() => {
    return rootCategories
      .map((cat) => {
        const subtreeIds = collectCategorySubtreeIds(cat.id, categories);
        const seen = new Set<number>();
        const list: Item[] = [];
        for (const catId of subtreeIds) {
          const rows = categoryItems
            .filter((ci) => ci.categoryId === catId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          for (const ci of rows) {
            if (seen.has(ci.itemId)) continue;
            const item = items.find((i) => i.id === ci.itemId);
            if (item && isAvailableOnChannelAt(item, 'visibilityKiosk')) {
              seen.add(ci.itemId);
              list.push(item);
            }
          }
        }
        return {
          categoryId: cat.id,
          name: cat.posDisplayName || cat.categoryName,
          image: cat.kioskImage || cat.image,
          items: list,
        };
      })
      .filter((s) => s.items.length > 0);
  }, [rootCategories, categories, categoryItems, items]);

  // Scrollspy: the active tab is the last section whose top has passed the
  // scroll container's top edge.
  const syncActive = useCallback(() => {
    const c = scrollRef.current;
    if (!c || sections.length === 0) return;
    const threshold = c.scrollTop + 12;
    let current = sections[0].categoryId;
    for (const s of sections) {
      const el = sectionRefs.current[s.categoryId];
      if (el && el.offsetTop <= threshold) current = s.categoryId;
    }
    setActiveCategoryId(current);
  }, [sections]);

  useEffect(() => {
    setActiveCategoryId(sections[0]?.categoryId ?? null);
    // Reset scroll to top when the menu changes.
    scrollRef.current?.scrollTo({ top: 0 });
  }, [sections]);

  // Keep the active tab scrolled into view within the tab bar.
  useEffect(() => {
    if (activeCategoryId != null) {
      tabRefs.current[activeCategoryId]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }, [activeCategoryId]);

  const scrollToSection = (categoryId: number) => {
    setActiveCategoryId(categoryId);
    sectionRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header: title + start-new-order */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-[#242528]">Menu</h1>
        <button
          type="button"
          onClick={onStartNewOrder}
          className="flex items-center gap-2 rounded-full border border-[#ED7C69] px-4 py-2 text-sm font-semibold text-[#ED7C69] transition-colors hover:bg-[#ED7C69]/5"
        >
          <RotateCcw className="h-4 w-4" />
          Start new order
        </button>
      </div>

      {/* Menu tabs (only when more than one menu exists) */}
      {sortedMenus.length > 1 && (
        <div className="shrink-0 bg-white px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sortedMenus.map((menu) => {
              const isActive = menu.id === selectedMenuId;
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => setSelectedMenu(menu.id)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'bg-[#242528] text-white' : 'text-[#6B6B6B] hover:bg-[#F1F1F1]',
                  )}
                >
                  {menu.posDisplayName || menu.menuName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category tab bar — tapping scrolls to the section */}
      {sections.length > 0 && (
        <div className="shrink-0 border-b border-black/5 bg-white px-4 py-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sections.map((s) => {
              const isActive = s.categoryId === activeCategoryId;
              return (
                <button
                  key={s.categoryId}
                  ref={(el) => (tabRefs.current[s.categoryId] = el)}
                  type="button"
                  onClick={() => scrollToSection(s.categoryId)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-[#ED7C69] text-white shadow-sm'
                      : 'bg-[#F1F1F1] text-[#6B6B6B] hover:bg-[#E7E7E7]',
                  )}
                >
                  <CategoryThumb name={s.name} image={s.image} />
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* One continuous scrolling list, grouped into labeled sections */}
      <div ref={scrollRef} onScroll={syncActive} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {sections.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[#9A9A9A]">
            No kiosk-visible items in this menu
          </div>
        ) : (
          sections.map((s) => (
            <section
              key={s.categoryId}
              ref={(el) => (sectionRefs.current[s.categoryId] = el)}
              className="scroll-mt-2 pb-6"
            >
              <h2 className="mb-3 text-lg font-bold text-[#242528]">{s.name}</h2>
              <div className="grid grid-cols-2 gap-3">
                {s.items.map((item) => (
                  <KioskItemCard key={item.id} item={item} onClick={() => onSelectItem(item)} />
                ))}
              </div>
            </section>
          ))
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

/** Small round category image shown inside each category tab. */
function CategoryThumb({ name, image }: { name: string; image: string }) {
  const [imgError, setImgError] = useState(false);
  const showImage = image && !imgError;
  return (
    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/70">
      {showImage ? (
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#C9C9C9]">
          <UtensilsCrossed className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
