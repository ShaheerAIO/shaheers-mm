import { useState, useEffect, useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Plus, GripVertical, Pencil, Search, X, Library, Trash2, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import type { Category, Item } from '@/types/menu';
import { AddItemsModal } from './AddItemsModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CategoryColumnProps {
  category: Category;
  subcategories: Category[];
  items: Item[];
  isExpanded: boolean;
  onExpand: () => void;
}

export function CategoryColumn({
  category,
  subcategories,
  items,
  isExpanded,
  onExpand,
}: CategoryColumnProps) {
  const { 
    selectedItemId, 
    setSelectedItem, 
    addItem, 
    addCategoryItem,
    removeCategoryItem,
    deleteCategory,
    addCategory,
    getNextId,
    categoryItems,
    updateCategory,
  } = useMenuStore();
  const [activeSubcat, setActiveSubcat] = useState<number | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(category.categoryName);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ itemId: number; categoryItemId: number } | null>(null);
  const [subcatToDelete, setSubcatToDelete] = useState<Category | null>(null);
  const [editingSubcatId, setEditingSubcatId] = useState<number | null>(null);
  const [subcatDraftName, setSubcatDraftName] = useState('');

  // Reset temp name when category changes
  useEffect(() => {
    setTempName(category.categoryName);
    setIsEditingName(false);
  }, [category.id, category.categoryName]);

  useEffect(() => {
    if (
      editingSubcatId != null &&
      !subcategories.some((s) => s.id === editingSubcatId)
    ) {
      setEditingSubcatId(null);
      setSubcatDraftName('');
    }
  }, [subcategories, editingSubcatId]);

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== category.categoryName) {
      updateCategory(category.id, { 
        categoryName: tempName.trim(),
        posDisplayName: tempName.trim(),
      });
    }
    setIsEditingName(false);
  };

  // Get categoryItem mappings for this category
  const categoryCategoryItems = useMemo(() => {
    const targetCategoryId = activeSubcat || category.id;
    return categoryItems.filter(ci => ci.categoryId === targetCategoryId);
  }, [categoryItems, activeSubcat, category.id]);

  // Filter items by active subcategory and search query
  const displayItems = useMemo(() => {
    let filtered = activeSubcat 
      ? items.filter(item => {
          // Check if item belongs to this subcategory via categoryItems
          return categoryItems.some(ci => 
            ci.categoryId === activeSubcat && ci.itemId === item.id
          );
        })
      : items;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.itemName.toLowerCase().includes(query) ||
        item.posDisplayName.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [items, activeSubcat, categoryItems, searchQuery]);

  const handleItemClick = (itemId: number) => {
    setSelectedItem(itemId);
  };

  const handleAddItem = () => {
    const targetCategoryId = activeSubcat || category.id;
    
    // Create new item
    const newItemId = getNextId('items');
    const newItem: Item = {
      id: newItemId,
      itemName: 'New Item',
      posDisplayName: 'New Item',
      kdsName: 'New Item',
      itemDescription: '',
      itemPicture: '',
      onlineImage: '',
      landscapeImage: '',
      thirdPartyImage: '',
      kioskItemImage: '',
      itemPrice: 0,
      taxLinkedWithParentSetting: true,
      calculatePricesWithTaxIncluded: false,
      takeoutException: false,
      stockStatus: 'inStock',
      stockValue: 0,
      orderQuantityLimit: false,
      minLimit: 0,
      maxLimit: 0,
      noMaxLimit: true,
      stationIds: '',
      preparationTime: 0,
      calories: 0,
      tagIds: '',
      inheritTagsFromCategory: true,
      saleCategory: '',
      allergenIds: '',
      inheritModifiersFromCategory: true,
      addonIds: '',
      isSpecialRequest: false,
      visibilityPos: true,
      visibilityKiosk: true,
      visibilityOnline: true,
      visibilityThirdParty: true,
      availableDays: '',
      availableTimeStart: '',
      availableTimeEnd: '',
    };
    
    // Add the item
    addItem(newItem);
    
    // Add to category via join table
    const currentCategoryItems = categoryItems.filter(ci => ci.categoryId === targetCategoryId);
    addCategoryItem({
      id: getNextId('items'), // Using items for ID generation (could be separate)
      categoryId: targetCategoryId,
      itemId: newItemId,
      sortOrder: currentCategoryItems.length,
    });
    
    // Select the new item
    setSelectedItem(newItemId);
  };

  const handleRemoveItemFromCategory = (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetCategoryId = activeSubcat || category.id;
    const categoryItem = categoryItems.find(
      ci => ci.categoryId === targetCategoryId && ci.itemId === itemId
    );
    if (categoryItem) {
      setItemToRemove({ itemId, categoryItemId: categoryItem.id });
    }
  };

  const confirmRemoveItem = () => {
    if (itemToRemove) {
      removeCategoryItem(itemToRemove.categoryItemId);
      setItemToRemove(null);
    }
  };

  const handleDeleteCategory = () => {
    deleteCategory(category.id);
    setShowDeleteConfirm(false);
  };

  const handleAddSubcategory = () => {
    const newSubcat: Category = {
      id: getNextId('categories'),
      categoryName: 'New Subcategory',
      posDisplayName: 'New Subcategory',
      kdsDisplayName: 'New Subcategory',
      color: category.color,
      image: '',
      kioskImage: '',
      parentCategoryId: category.id,
      tagIds: '',
      menuIds: category.menuIds,
      sortOrder: subcategories.length,
    };
    addCategory(newSubcat);
    setActiveSubcat(newSubcat.id);
  };

  const handleDeleteSubcategory = (subcat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubcatToDelete(subcat);
  };

  const confirmDeleteSubcategory = () => {
    if (subcatToDelete) {
      if (activeSubcat === subcatToDelete.id) setActiveSubcat(null);
      deleteCategory(subcatToDelete.id);
      setSubcatToDelete(null);
    }
  };

  const startSubcategoryRename = (subcat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSubcat(subcat.id);
    setEditingSubcatId(subcat.id);
    setSubcatDraftName(subcat.categoryName);
  };

  const cancelSubcategoryRename = (subcat: Category) => {
    setSubcatDraftName(subcat.categoryName);
    setEditingSubcatId(null);
  };

  const submitSubcategoryRename = (subcat: Category) => {
    const trimmed = subcatDraftName.trim();
    if (!trimmed) {
      cancelSubcategoryRename(subcat);
      return;
    }
    if (trimmed !== subcat.categoryName) {
      updateCategory(subcat.id, {
        categoryName: trimmed,
        posDisplayName: trimmed,
        kdsDisplayName: trimmed,
      });
    }
    setEditingSubcatId(null);
    setSubcatDraftName('');
  };

  if (!isExpanded) {
    return (
      <div 
        className="category-column minimized"
        onClick={onExpand}
      >
        <div className="category-header text-center truncate">
          <span className="writing-mode-vertical text-xs">{category.categoryName}</span>
        </div>
        <div className="flex-1 p-1.5 space-y-1 overflow-hidden">
          {items.slice(0, 8).map((item) => (
            <div 
              key={item.id} 
              className={cn(
                "text-[10px] truncate px-1.5 py-1 rounded text-muted-foreground",
                item.stockStatus === 'outOfStock' && "line-through opacity-50"
              )}
            >
              {shortenName(item.itemName)}
            </div>
          ))}
          {items.length > 8 && (
            <div className="text-[10px] text-muted-foreground text-center">
              +{items.length - 8} more
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="category-column expanded">
        <div className="category-header flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />
            <input
              type="color"
              value={category.color?.trim() || '#f97316'}
              onChange={(e) => updateCategory(category.id, { color: e.target.value })}
              className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border border-border/50 bg-transparent p-0 [appearance:none] [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0"
              title="Category color"
              aria-label="Category color"
            />
            {isEditingName ? (
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleNameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit();
                  if (e.key === 'Escape') {
                    setTempName(category.categoryName);
                    setIsEditingName(false);
                  }
                }}
                className="flex-1 bg-transparent border-b border-primary outline-none text-sm font-medium"
                autoFocus
              />
            ) : (
              <span 
                onClick={() => setIsEditingName(true)}
                className="truncate cursor-pointer hover:text-primary transition-colors"
                title="Click to edit"
              >
                {category.categoryName}
              </span>
            )}
            {!isEditingName && (
              <button
                onClick={() => setIsEditingName(true)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <span className="text-xs text-muted-foreground">{items.length}</span>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete category"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subcategory Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-panel-border overflow-x-auto items-center">
          {subcategories.length > 0 && (
            <button
              onClick={() => setActiveSubcat(null)}
              className={cn(
                "px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap flex-shrink-0",
                !activeSubcat 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              All
            </button>
          )}
          {subcategories.map((subcat) => (
            <div
              key={subcat.id}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap flex-shrink-0 group/tab min-w-0 max-w-[200px]",
                activeSubcat === subcat.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {editingSubcatId === subcat.id ? (
                <input
                  type="text"
                  value={subcatDraftName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setSubcatDraftName(e.target.value)}
                  onBlur={() => submitSubcategoryRename(subcat)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelSubcategoryRename(subcat);
                    }
                  }}
                  className={cn(
                    "min-w-0 flex-1 bg-background/90 text-foreground border border-border rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring",
                    activeSubcat === subcat.id && "bg-background text-foreground"
                  )}
                  autoFocus
                  aria-label="Subcategory name"
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveSubcat(subcat.id)}
                    onDoubleClick={(e) => startSubcategoryRename(subcat, e)}
                    className="leading-none truncate min-w-0 text-left"
                    title="Double-click to rename"
                  >
                    {subcat.categoryName}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => startSubcategoryRename(subcat, e)}
                    className={cn(
                      "flex-shrink-0 p-0.5 rounded transition-opacity",
                      activeSubcat === subcat.id
                        ? "text-primary-foreground/80 hover:text-primary-foreground opacity-0 group-hover/tab:opacity-100"
                        : "text-muted-foreground/80 hover:text-foreground opacity-0 group-hover/tab:opacity-100"
                    )}
                    title="Rename subcategory"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </>
              )}
              {editingSubcatId !== subcat.id && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteSubcategory(subcat, e)}
                  className={cn(
                    "leading-none transition-opacity flex-shrink-0",
                    activeSubcat === subcat.id
                      ? "text-primary-foreground/70 hover:text-primary-foreground opacity-0 group-hover/tab:opacity-100"
                      : "text-muted-foreground/60 hover:text-destructive opacity-0 group-hover/tab:opacity-100"
                  )}
                  title="Delete subcategory"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddSubcategory}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap flex-shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="Add subcategory"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-panel-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {displayItems.length === 0 && searchQuery ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No items match "{searchQuery}"
            </div>
          ) : null}
          {displayItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                "item-row flex items-center justify-between group",
                selectedItemId === item.id && "selected",
                item.stockStatus === 'outOfStock' && "is-86"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab flex-shrink-0" />
                <span className="truncate">{shortenName(item.itemName)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  ${item.itemPrice.toFixed(2)}
                </span>
                <button
                  onClick={(e) => handleRemoveItemFromCategory(item.id, e)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from category"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Item Buttons */}
        <div className="p-3 border-t border-panel-border space-y-2">
          <button 
            className="btn-add w-full justify-center"
            onClick={handleAddItem}
          >
            <Plus className="w-3.5 h-3.5" />
            New Item
          </button>
          <button 
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => setShowAddItemsModal(true)}
          >
            <Library className="w-3.5 h-3.5" />
            Add Existing Items
          </button>
        </div>
      </div>

      {/* Add Items Modal */}
      <AddItemsModal
        isOpen={showAddItemsModal}
        onClose={() => setShowAddItemsModal(false)}
        categoryId={activeSubcat || category.id}
        categoryName={activeSubcat 
          ? subcategories.find(s => s.id === activeSubcat)?.categoryName || category.categoryName
          : category.categoryName
        }
      />

      {/* Remove Item Confirmation */}
      <AlertDialog open={!!itemToRemove} onOpenChange={() => setItemToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item from Category</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item from this category. The item itself will not be deleted and can be added to other categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveItem}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{category.categoryName}"? This will remove the category and all item assignments. The items themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Subcategory Confirmation */}
      <AlertDialog open={!!subcatToDelete} onOpenChange={() => setSubcatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subcategory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{subcatToDelete?.categoryName}"? This will remove the subcategory and all its item assignments. The items themselves will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteSubcategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
