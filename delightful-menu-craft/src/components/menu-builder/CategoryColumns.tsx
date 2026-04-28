import { useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { CategoryColumn } from './CategoryColumn';
import { Plus, Upload } from 'lucide-react';
import type { Category, Item } from '@/types/menu';
import { RIGHT_PANEL_WIDTH_PX, CATEGORY_PANEL_WIDTH_PX } from '@/lib/rightPanelWidth';

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
  } = useMenuStore();

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

  // Get subcategories for a parent
  const getSubcategories = (parentId: number): Category[] => {
    return categories
      .filter(c => c.parentCategoryId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  // Get items for a category using the categoryItems join table
  const getItemsForCategory = (catId: number): Item[] => {
    // Get all items that belong to this category via categoryItems join table
    const matchingCategoryItems = categoryItems.filter(ci => ci.categoryId === catId);
    
    const categoryItemIds = matchingCategoryItems
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(ci => ci.itemId);
    
    // Also include items from subcategories
    const subcats = getSubcategories(catId);
    subcats.forEach(subcat => {
      const subcatItemIds = categoryItems
        .filter(ci => ci.categoryId === subcat.id)
        .map(ci => ci.itemId);
      categoryItemIds.push(...subcatItemIds);
    });

    // Map item IDs to actual items
    return categoryItemIds
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
      color: '#6366f1',
      image: '',
      kioskImage: '',
      parentCategoryId: null,
      tagIds: '',
      menuIds: selectedMenuId.toString(),
      sortOrder: menuCategories.length,
      visibilityPos: true,
      visibilityKiosk: true,
      visibilityQr: true,
      visibilityWebsite: true,
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

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Data Loaded</h3>
          <p className="text-sm text-muted-foreground">
            Import an Excel file to get started
          </p>
        </div>
      </div>
    );
  }

  if (!selectedMenuId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p>Select a menu to view categories</p>
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
      {menuCategories.map((category) => (
        <CategoryColumn
          key={category.id}
          category={category}
          subcategories={getSubcategories(category.id)}
          items={getItemsForCategory(category.id)}
          isExpanded={selectedCategoryId === category.id}
          onExpand={() => handleCategoryClick(category.id)}
        />
      ))}
      
      {/* Add Category Button */}
      <div className="flex items-start p-4 flex-shrink-0">
        <button 
          className="btn-add whitespace-nowrap"
          onClick={handleAddCategory}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Category
        </button>
      </div>
    </div>
  );
}
