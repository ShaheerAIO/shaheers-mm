import { useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { useIsReadOnly } from '@/lib/workspaceSync';
import { CategoryColumn } from './CategoryColumn';
import { Plus, Upload, LayoutList } from 'lucide-react';
import type { Category, Item } from '@/types/menu';
import { RIGHT_PANEL_WIDTH_PX, CATEGORY_PANEL_WIDTH_PX } from '@/lib/rightPanelWidth';
import { DEFAULT_CATEGORY_COLOR } from '@/lib/posColors';

export function CategoryColumns() {
  const {
    categories,
    items,
    categoryItems,
    selectedMenuId,
    selectedCategoryId,
    setSelectedCategory,
    isDataLoaded,
    addCategory,
    getNextId,
    selectedItemId,
    editingCategoryId,
    editingMenuId,
    isCreatingModifier,
    isCreatingOption,
    reorderCategories,
  } = useMenuStore();
  const isReadOnly = useIsReadOnly();

  const panelWidth =
    (selectedItemId ? RIGHT_PANEL_WIDTH_PX : 0) +
    (editingCategoryId ? CATEGORY_PANEL_WIDTH_PX : 0) +
    (editingMenuId ? CATEGORY_PANEL_WIDTH_PX : 0) +
    (isCreatingModifier ? RIGHT_PANEL_WIDTH_PX : 0) +
    (isCreatingOption ? RIGHT_PANEL_WIDTH_PX : 0);

  // Get categories for the selected menu
  // Categories are linked to menus via the menuIds field (comma-separated)
  const menuCategories = useMemo(() => {
    if (!selectedMenuId) return [];
    return categories
      .filter(c => {
        // Check if this category belongs to the selected menu
        const menuIdList = c.menuIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
        return menuIdList.includes(selectedMenuId);
      })
      .filter(c => !c.parentCategoryId) // Root categories only
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, selectedMenuId]);

  // Collect a category id plus all of its descendant ids (recursive, cycle-safe).
  const collectSubtreeIds = (rootId: number): number[] => {
    const visited = new Set<number>();
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const c of categories) {
        if (c.parentCategoryId === id && !visited.has(c.id)) stack.push(c.id);
      }
    }
    return Array.from(visited);
  };

  // Get items for a category using the categoryItems join table.
  // Rolls up items from the full descendant subtree, deduped so an item that
  // appears under multiple descendants is only counted once.
  const getItemsForCategory = (catId: number): Item[] => {
    const subtreeIds = new Set(collectSubtreeIds(catId));
    const seenItemIds = new Set<number>();
    const orderedItemIds: number[] = [];

    categoryItems
      .filter(ci => subtreeIds.has(ci.categoryId))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach(ci => {
        if (!seenItemIds.has(ci.itemId)) {
          seenItemIds.add(ci.itemId);
          orderedItemIds.push(ci.itemId);
        }
      });

    // Map item IDs to actual items
    return orderedItemIds
      .map(itemId => items.find(i => i.id === itemId))
      .filter((item): item is Item => item !== undefined);
  };

  const handleAddCategory = () => {
    if (!selectedMenuId) return;
    
    const newCategory: Category = {
      id: getNextId('categories'),
      categoryName: 'New Category',
      posDisplayName: 'New Category',
      kdsDisplayName: 'New Category',
      color: DEFAULT_CATEGORY_COLOR,
      image: '',
      kioskImage: '',
      parentCategoryId: null,
      tagIds: '',
      menuIds: selectedMenuId.toString(),
      sortOrder: menuCategories.length,
      visibilityPos: true,
      visibilityKiosk: true,
      visibilityMenuBoard: true,
      visibilityNugget: true,
      visibilityQr: true,
      visibilityWebsite: true,
      visibilityOnline: true,
      visibilityMobileApp: true,
      visibilityDoordash: true,
      daySchedules: JSON.stringify({ Mon: { enabled: true, start: '', end: '' }, Tue: { enabled: true, start: '', end: '' }, Wed: { enabled: true, start: '', end: '' }, Thu: { enabled: true, start: '', end: '' }, Fri: { enabled: true, start: '', end: '' }, Sat: { enabled: true, start: '', end: '' }, Sun: { enabled: true, start: '', end: '' } }),
    };

    addCategory(newCategory);
    setSelectedCategory(newCategory.id);
  };

  const handleCategoryClick = (categoryId: number) => {
    // Toggle: if clicking the already selected category, deselect it
    if (selectedCategoryId === categoryId) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryId);
    }
  };

  // Empty states are first-class in the AIO language: a tinted icon, a bold
  // line, then one plain-language line telling you what to do next.
  if (!isDataLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--aio-accent-soft)] text-[var(--aio-accent-text)]">
            <Upload className="h-5 w-5" />
          </span>
          <h3 className="text-[15px] font-semibold text-ink">Nothing loaded yet</h3>
          <p className="aio-sub max-w-xs">
            Import an Excel workbook from <b className="font-medium text-ink-2">File → Import</b>, or
            start fresh to build a menu by hand.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedMenuId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-ink-faint">
            <LayoutList className="h-5 w-5" />
          </span>
          <h3 className="text-[15px] font-semibold text-ink">Pick a menu to start</h3>
          <p className="aio-sub max-w-xs">Choose one from the menu selector, top right.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-row overflow-x-auto overflow-y-hidden scrollbar-thin transition-[padding] duration-300"
      style={{ paddingRight: panelWidth }}
    >
      {/* All categories in their natural order */}
      {menuCategories.map((category, index) => (
        <CategoryColumn
          key={category.id}
          category={category}
          items={getItemsForCategory(category.id)}
          isExpanded={selectedCategoryId === category.id}
          onExpand={() => handleCategoryClick(category.id)}
          reorder={{
            position: index + 1,
            positionCount: menuCategories.length,
            onSetPosition: (n) => {
              if (isReadOnly) return;
              const clamped = Math.max(1, Math.min(menuCategories.length, Math.round(n)));
              if (clamped - 1 === index) return;
              reorderCategories(null, index, clamped - 1, selectedMenuId ?? undefined);
            },
          }}
        />
      ))}
      
      {/* Add Category Button */}
      {!isReadOnly && (
        <div className="flex items-start p-4 flex-shrink-0">
          <button
            className="btn-add whitespace-nowrap"
            onClick={handleAddCategory}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category
          </button>
        </div>
      )}
    </div>
  );
}
