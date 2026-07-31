import { useState, useEffect, useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { useIsReadOnly } from '@/lib/workspaceSync';
import { Plus, GripVertical, Search, X, Library, Trash2, FolderPlus, Pencil, Copy, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import type { Category, Item } from '@/types/menu';
import { AddItemsModal } from './AddItemsModal';
import { ColorPalettePicker } from '@/components/ColorPalettePicker';
import { CATEGORY_COLOR_PALETTE, DEFAULT_CATEGORY_COLOR, pickUnusedCategoryColor } from '@/lib/posColors';
import { defaultVisibility, defaultDaySchedules, serializeDaySchedules } from '@/lib/visibility';
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
  items: Item[];
  isExpanded: boolean;
  onExpand: () => void;
  /** Position control for reordering this root column among its siblings. */
  reorder?: {
    /** 1-based position among visible sibling columns, and a setter to move there. */
    position: number;
    positionCount: number;
    onSetPosition: (n: number) => void;
  };
}

export function CategoryColumn({
  category,
  items,
  isExpanded,
  onExpand,
  reorder,
}: CategoryColumnProps) {
  const {
    selectedItemId,
    setSelectedItem,
    addItem,
    addCategoryItem,
    removeCategoryItem,
    deleteCategory,
    addCategory,
    duplicateItem,
    getNextId,
    categories,
    categoryItems,
    updateCategory,
    setEditingCategory,
    reorderCategories,
    reorderCategoryItems,
  } = useMenuStore();
  const isReadOnly = useIsReadOnly();
  const [activeSubcat, setActiveSubcat] = useState<number | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(category.categoryName);
  const [searchQuery, setSearchQuery] = useState('');
  // View-only sort for the item list. Purely cosmetic — never writes to the
  // menu store, so the saved/exported item order is unaffected. Drag-reorder is
  // disabled while this is anything but 'manual'. Persisted as a user preference.
  const sortMode = useUserPreferencesStore((s) => s.categoryItemSort);
  const setSortMode = useUserPreferencesStore((s) => s.setCategoryItemSort);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ itemId: number; categoryItemId: number; categoryId: number } | null>(null);
  const [subcatToDelete, setSubcatToDelete] = useState<Category | null>(null);
  const [editingSubcatId, setEditingSubcatId] = useState<number | null>(null);
  const [subcatDraftName, setSubcatDraftName] = useState('');
  const [confirmAddSubcatWithItems, setConfirmAddSubcatWithItems] = useState<{ parentId: number; categoryName: string; itemCount: number } | null>(null);
  const [cannotAddItemReason, setCannotAddItemReason] = useState<string | null>(null);
  // Native DnD state for reordering items in the focused category.
  const [itemDragIndex, setItemDragIndex] = useState<number | null>(null);
  const [itemDragOverIndex, setItemDragOverIndex] = useState<number | null>(null);
  // Native DnD state for reordering subcategory chips within a row.
  const [subcatDrag, setSubcatDrag] = useState<{ parentId: number; index: number } | null>(null);
  const [subcatDragOver, setSubcatDragOver] = useState<{ parentId: number; index: number } | null>(null);
  const [subcatDragArmed, setSubcatDragArmed] = useState(false);
  // Editable draft for the numeric position control in the header.
  const [positionDraft, setPositionDraft] = useState('');

  // Direct children of a given category id, sorted.
  const childrenOf = (parentId: number): Category[] =>
    categories
      .filter((c) => c.parentCategoryId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  // The chain of category ids from the root's direct children down to the
  // currently-active subcategory (cycle-safe). Empty when nothing is drilled.
  const activePath = useMemo(() => {
    if (!activeSubcat) return [] as number[];
    const byId = new Map(categories.map((c) => [c.id, c]));
    const chain: number[] = [];
    const seen = new Set<number>();
    let cur: number | null = activeSubcat;
    while (cur != null && cur !== category.id && !seen.has(cur)) {
      seen.add(cur);
      chain.unshift(cur);
      cur = byId.get(cur)?.parentCategoryId ?? null;
    }
    // Only valid if the chain actually roots at this column's category.
    return cur === category.id ? chain : [];
  }, [activeSubcat, categories, category.id]);

  // One chip row per drill level: row 0 = root's children, row N = children of
  // the level-(N-1) selection. Each row is shown as long as it has children.
  const subcatRows = useMemo(() => {
    const rows: { parentId: number; selectedId: number | null; children: Category[] }[] = [];
    let parentId = category.id;
    let depth = 0;
    // Walk the active path; render the row of siblings at each level.
    for (let children = childrenOf(parentId); children.length > 0; ) {
      const selectedId = activePath[depth] ?? null;
      rows.push({ parentId, selectedId, children });
      if (selectedId == null) break;
      parentId = selectedId;
      depth += 1;
      children = childrenOf(parentId);
    }
    return rows;
    // childrenOf reads `categories`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, categories, activePath]);

  // The currently focused category at any depth (root when nothing drilled).
  const focusedCategory = useMemo(
    () => (activeSubcat ? categories.find((c) => c.id === activeSubcat) ?? category : category),
    [activeSubcat, categories, category]
  );

  // Accent color: active subcategory color when one is selected, otherwise root category color
  const accentColor = useMemo(
    () => focusedCategory.color?.trim() || category.color?.trim() || '#f97316',
    [focusedCategory, category.color]
  );

  // Collect a category id plus all descendant ids (recursive, cycle-safe).
  const collectSubtreeIds = (rootId: number): Set<number> => {
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
    return visited;
  };

  // Reset temp name when category changes
  useEffect(() => {
    setTempName(category.categoryName);
    setIsEditingName(false);
  }, [category.id, category.categoryName]);

  useEffect(() => {
    if (
      editingSubcatId != null &&
      !categories.some((s) => s.id === editingSubcatId)
    ) {
      setEditingSubcatId(null);
      setSubcatDraftName('');
    }
  }, [categories, editingSubcatId]);

  // Keep the position input in sync with the column's actual position.
  useEffect(() => {
    if (reorder) setPositionDraft(String(reorder.position));
  }, [reorder?.position]);

  const commitPosition = () => {
    if (!reorder) return;
    const n = parseInt(positionDraft, 10);
    if (isNaN(n)) {
      setPositionDraft(String(reorder.position)); // revert invalid input
      return;
    }
    reorder.onSetPosition(n);
  };

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== category.categoryName) {
      updateCategory(category.id, {
        categoryName: tempName.trim(),
        posDisplayName: tempName.trim(),
        // Auto-populate KDS while it's still tracking the name (not manually customized).
        // Empty KDS (imported/legacy categories) counts as uncustomized too.
        ...(!category.kdsDisplayName || category.kdsDisplayName === category.categoryName ? { kdsDisplayName: tempName.trim() } : {}),
      });
    }
    setIsEditingName(false);
  };

  // Get categoryItem mappings for this category
  const categoryCategoryItems = useMemo(() => {
    const targetCategoryId = activeSubcat || category.id;
    return categoryItems.filter(ci => ci.categoryId === targetCategoryId);
  }, [categoryItems, activeSubcat, category.id]);

  // Filter items by active subcategory and search query.
  // Order comes from the categoryItems join sortOrder (not the incoming `items`
  // array order), rolled up across the focused scope's descendant subtree and
  // deduped — mirrors CategoryColumns.getItemsForCategory so reordering shows
  // immediately.
  const displayItems = useMemo(() => {
    const scopeRootId = activeSubcat || category.id;
    const subtreeIds = collectSubtreeIds(scopeRootId);
    const itemById = new Map(items.map((it) => [it.id, it]));
    const seen = new Set<number>();
    const ordered: Item[] = [];
    categoryItems
      .filter((ci) => subtreeIds.has(ci.categoryId))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((ci) => {
        if (seen.has(ci.itemId)) return;
        seen.add(ci.itemId);
        const it = itemById.get(ci.itemId);
        if (it) ordered.push(it);
      });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return ordered.filter(item =>
        item.itemName.toLowerCase().includes(query) ||
        item.posDisplayName.toLowerCase().includes(query)
      );
    }

    return ordered;
    // collectSubtreeIds reads `categories`, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeSubcat, category.id, categoryItems, categories, searchQuery]);

  // Cosmetic re-sort of the visible list. 'manual' preserves the store order
  // (and is the only mode where drag-reorder is allowed).
  const viewItems = useMemo(() => {
    if (sortMode === 'manual') return displayItems;
    const sorted = [...displayItems];
    switch (sortMode) {
      case 'name-asc': sorted.sort((a, b) => a.itemName.localeCompare(b.itemName)); break;
      case 'name-desc': sorted.sort((a, b) => b.itemName.localeCompare(a.itemName)); break;
      case 'price-asc': sorted.sort((a, b) => a.itemPrice - b.itemPrice); break;
      case 'price-desc': sorted.sort((a, b) => b.itemPrice - a.itemPrice); break;
    }
    return sorted;
  }, [displayItems, sortMode]);

  const handleItemClick = (itemId: number) => {
    setSelectedItem(itemId);
  };

  const handleAddItem = () => {
    const targetCategoryId = activeSubcat || category.id;

    // Prevent adding items when "All" is selected in subcategories
    // (items belong to specific categories, not to a rolled-up view)
    if (activeSubcat === null && subcatRows.length > 0) {
      setCannotAddItemReason('Please select a specific category or subcategory to add an item.');
      return;
    }

    // Enforce rule: items and subcategories cannot coexist in the same category
    // A category is either a leaf (has items) or a parent (has subcategories), never both
    const hasSubcategories = categories.some(c => c.parentCategoryId === targetCategoryId);
    if (hasSubcategories) {
      const targetCategory = categories.find(c => c.id === targetCategoryId);
      setCannotAddItemReason(
        `Cannot add items to "${targetCategory?.categoryName}". This category has subcategories. Items can only be added to leaf categories (categories without subcategories).`
      );
      return;
    }

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
      salesTax: true,
      takeoutException: false,
      stockStatus: 'inStock',
      stockValue: 0,
      orderQuantityLimit: true,
      minLimit: 1,
      maxLimit: 1,
      noMaxLimit: true,
      stationIds: '',
      preparationTime: 0,
      calories: 0,
      tagIds: '',
      inheritTagsFromCategory: true,
      saleCategory: 'Food Sales',
      allergenIds: '',
      inheritModifiersFromCategory: true,
      addonIds: '',
      isSpecialRequest: false,
      doordashPrice: 0,
      uberEatsPrice: 0,
      grubHubPrice: 0,
      ...defaultVisibility(),
      inheritVisibilityFromCategory: true,
      daySchedules: serializeDaySchedules(defaultDaySchedules()),
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
      setItemToRemove({
        itemId,
        categoryItemId: categoryItem.id,
        categoryId: categoryItem.categoryId
      });
    }
  };

  const confirmRemoveItem = () => {
    if (itemToRemove) {
      removeCategoryItem(itemToRemove.categoryId, itemToRemove.itemId);
      setItemToRemove(null);
    }
  };

  const handleDeleteCategory = () => {
    deleteCategory(category.id);
    setShowDeleteConfirm(false);
  };

  // Creates a new subcategory under `parentId`. Assumes the caller has already
  // handled the items-in-parent check (see handleAddSubcategory).
  const createSubcategory = (parentId: number) => {
    const siblings = childrenOf(parentId);
    const siblingColors = siblings.map((s) => s.color).filter(Boolean) as string[];
    const newSubcat: Category = {
      id: getNextId('categories'),
      categoryName: 'New Subcategory',
      posDisplayName: 'New Subcategory',
      kdsDisplayName: 'New Subcategory',
      color: pickUnusedCategoryColor(siblingColors),
      image: '',
      kioskImage: '',
      parentCategoryId: parentId,
      tagIds: '',
      menuIds: category.menuIds,
      sortOrder: siblings.length,
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
    addCategory(newSubcat);
    // Keep the focus on the parent (don't drill into the new subcategory) so a
    // subsequent "Add subcategory" creates a sibling next to this one rather
    // than nesting it underneath. To nest deeper the user first selects a chip.
    setActiveSubcat(parentId === category.id ? null : parentId);
  };

  const handleAddSubcategory = () => {
    // Nest under the currently-focused subcategory (or the root when none is drilled)
    const parentId = activeSubcat ?? category.id;

    // Enforce rule: a category cannot have both items AND subcategories.
    // If the parent already holds items, ask the user to confirm before we
    // detach those items and proceed (rather than silently blocking).
    const parentCategoryItems = categoryItems.filter(ci => ci.categoryId === parentId);
    if (parentCategoryItems.length > 0) {
      const parentCategory = categories.find(c => c.id === parentId);
      setConfirmAddSubcatWithItems({
        parentId,
        categoryName: parentCategory?.categoryName || 'This category',
        itemCount: parentCategoryItems.length,
      });
      return;
    }

    createSubcategory(parentId);
  };

  const confirmAddSubcategoryAndClearItems = () => {
    if (!confirmAddSubcatWithItems) return;
    const { parentId } = confirmAddSubcatWithItems;
    // Detach every item currently in the parent (items themselves are kept,
    // just no longer assigned to this now-parent category) then create it.
    categoryItems
      .filter((ci) => ci.categoryId === parentId)
      .forEach((ci) => removeCategoryItem(ci.categoryId, ci.itemId));
    createSubcategory(parentId);
    setConfirmAddSubcatWithItems(null);
  };

  const handleDeleteSubcategory = (subcat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubcatToDelete(subcat);
  };

  const confirmDeleteSubcategory = () => {
    if (subcatToDelete) {
      // If the focused subcategory is the one being deleted (or a descendant of
      // it), drop the focus back to the deleted node's parent.
      if (activeSubcat != null && collectSubtreeIds(subcatToDelete.id).has(activeSubcat)) {
        setActiveSubcat(subcatToDelete.parentCategoryId === category.id ? null : subcatToDelete.parentCategoryId);
      }
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

  // Focused category id (root or drilled subcategory) — the scope for item reorder.
  const focusedCategoryId = activeSubcat || category.id;

  // Item ids that belong DIRECTLY to the focused category, in sortOrder order.
  // Items rolled up from descendant subcategories are absent here and cannot be
  // reordered within this scope.
  const directItemIdOrder = useMemo(
    () =>
      categoryItems
        .filter((ci) => ci.categoryId === focusedCategoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ci) => ci.itemId),
    [categoryItems, focusedCategoryId]
  );

  const directIndexOfItem = (itemId: number) => directItemIdOrder.indexOf(itemId);

  const handleItemDragStart = (e: React.DragEvent, directIndex: number) => {
    if (isReadOnly || directIndex < 0) {
      e.preventDefault();
      return;
    }
    setItemDragIndex(directIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(directIndex));
  };

  const handleItemDragOver = (e: React.DragEvent, directIndex: number) => {
    if (itemDragIndex === null || directIndex < 0) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (directIndex !== itemDragOverIndex) setItemDragOverIndex(directIndex);
  };

  const handleItemDrop = (e: React.DragEvent, directIndex: number) => {
    e.preventDefault();
    if (itemDragIndex === null || directIndex < 0) return;
    const from = itemDragIndex;
    setItemDragIndex(null);
    setItemDragOverIndex(null);
    if (from === directIndex) return;
    reorderCategoryItems(focusedCategoryId, from, directIndex);
  };

  const handleItemDragEnd = () => {
    setItemDragIndex(null);
    setItemDragOverIndex(null);
  };

  const handleSubcatDragStart = (e: React.DragEvent, parentId: number, index: number) => {
    if (isReadOnly || !subcatDragArmed) {
      e.preventDefault();
      return;
    }
    setSubcatDrag({ parentId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleSubcatDragOver = (e: React.DragEvent, parentId: number, index: number) => {
    if (!subcatDrag || subcatDrag.parentId !== parentId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (subcatDragOver?.parentId !== parentId || subcatDragOver?.index !== index) {
      setSubcatDragOver({ parentId, index });
    }
  };

  const handleSubcatDrop = (e: React.DragEvent, parentId: number, index: number) => {
    e.preventDefault();
    if (!subcatDrag || subcatDrag.parentId !== parentId) return;
    const from = subcatDrag.index;
    setSubcatDrag(null);
    setSubcatDragOver(null);
    setSubcatDragArmed(false);
    if (from === index) return;
    // parentId === category.id means these are children of the root category;
    // the store treats that as a normal parented scope.
    reorderCategories(parentId, from, index);
  };

  const handleSubcatDragEnd = () => {
    setSubcatDrag(null);
    setSubcatDragOver(null);
    setSubcatDragArmed(false);
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
      <div
        className="category-column expanded"
        style={{
          borderLeftColor: accentColor,
          borderRightColor: accentColor,
          boxShadow: `0 0 0 1px ${accentColor}33, 0 0 18px ${accentColor}40`,
        }}
      >
        <div className="category-header flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {reorder && reorder.positionCount > 1 && (
              <div className="flex items-center flex-shrink-0" title="Category order">
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={isReadOnly || reorder.position <= 1}
                    onClick={() => reorder.onSetPosition(reorder.position - 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground leading-none"
                    aria-label="Move category up"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly || reorder.position >= reorder.positionCount}
                    onClick={() => reorder.onSetPosition(reorder.position + 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground leading-none"
                    aria-label="Move category down"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="number"
                  min={1}
                  max={reorder.positionCount}
                  value={positionDraft}
                  disabled={isReadOnly}
                  aria-label="Category order"
                  className="w-8 h-6 ml-0.5 rounded border border-border bg-background px-1 text-center text-xs text-foreground disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onChange={(e) => setPositionDraft(e.target.value)}
                  onBlur={commitPosition}
                  onKeyDown={(e) => {
                    // Blur triggers the single commit via onBlur — don't also
                    // commit here, or a second stale-index move lands it at n-1.
                    if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                    else if (e.key === 'Escape') { setPositionDraft(String(reorder.position)); (e.target as HTMLInputElement).blur(); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <ColorPalettePicker
              palette={CATEGORY_COLOR_PALETTE}
              value={category.color?.trim() || DEFAULT_CATEGORY_COLOR}
              onChange={(color) => updateCategory(category.id, { color })}
              triggerClassName="h-5 w-5 flex-shrink-0 rounded-full"
              title="Category color"
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
                onClick={() => { if (!isReadOnly) setIsEditingName(true); }}
                className={cn('truncate transition-colors', !isReadOnly && 'cursor-pointer hover:text-primary')}
                title={isReadOnly ? undefined : 'Click to edit'}
              >
                {category.categoryName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <span className="text-xs text-muted-foreground">{items.length}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setEditingCategory(category.id); }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Edit category settings"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!isReadOnly && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Subcategory Tabs (one row per drill level for nested subcategories) */}
        <div className="border-b border-panel-border">
          {subcatRows.length === 0 && !isReadOnly && (
            <div className="flex flex-wrap gap-1 px-3 py-2 items-center">
              <button
                onClick={handleAddSubcategory}
                className="flex items-center px-2 py-1 text-xs rounded-md transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="Add subcategory"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {subcatRows.map((row, depth) => (
            <div
              key={row.parentId}
              className={cn(
                'flex flex-wrap gap-1 px-3 py-2 items-center',
                depth > 0 && 'border-t border-panel-border/60 pl-5'
              )}
            >
              <button
                onClick={() => setActiveSubcat(row.parentId === category.id ? null : row.parentId)}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors whitespace-nowrap',
                  row.selectedId == null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                All
              </button>
              {!isReadOnly && depth === subcatRows.length - 1 && (
                <button
                  onClick={handleAddSubcategory}
                  className="flex items-center px-2 py-1 text-xs rounded-md transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10"
                  title={activeSubcat ? `Add subcategory under "${focusedCategory.categoryName}"` : 'Add subcategory'}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              )}
              {row.children.map((subcat, subcatIndex) => {
                const isActive = row.selectedId === subcat.id;
                const chipColor = subcat.color?.trim() || '#f97316';
                const isChipDragOver =
                  subcatDragOver?.parentId === row.parentId &&
                  subcatDragOver?.index === subcatIndex &&
                  subcatDrag?.index !== subcatIndex;
                return (
                  <div
                    key={subcat.id}
                    draggable={!isReadOnly && editingSubcatId !== subcat.id && subcatDragArmed}
                    onDragStart={(e) => handleSubcatDragStart(e, row.parentId, subcatIndex)}
                    onDragOver={(e) => handleSubcatDragOver(e, row.parentId, subcatIndex)}
                    onDrop={(e) => handleSubcatDrop(e, row.parentId, subcatIndex)}
                    onDragEnd={handleSubcatDragEnd}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors min-w-0 max-w-[200px]',
                      isActive ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                      isChipDragOver && 'ring-2 ring-primary ring-inset'
                    )}
                    style={isActive ? { backgroundColor: chipColor } : undefined}
                  >
                    {editingSubcatId !== subcat.id && !isReadOnly && (
                      <GripVertical
                        className={cn(
                          'w-3 h-3 flex-shrink-0 cursor-grab',
                          isActive ? 'text-white/70' : 'text-muted-foreground/60'
                        )}
                        onMouseDown={() => setSubcatDragArmed(true)}
                        onMouseUp={() => setSubcatDragArmed(false)}
                      />
                    )}
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
                          'min-w-0 flex-1 bg-background/90 text-foreground border border-border rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring',
                          isActive && 'bg-background text-foreground'
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
                          onClick={(e) => { e.stopPropagation(); setEditingCategory(subcat.id); }}
                          className={cn(
                            'flex-shrink-0 p-0.5 rounded transition-colors',
                            isActive
                              ? 'text-white/80 hover:text-white'
                              : 'text-muted-foreground/80 hover:text-foreground'
                          )}
                          title="Edit subcategory settings"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    {editingSubcatId !== subcat.id && !isReadOnly && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSubcategory(subcat, e)}
                        className={cn(
                          'leading-none transition-colors flex-shrink-0',
                          isActive
                            ? 'text-white/70 hover:text-white'
                            : 'text-muted-foreground/60 hover:text-destructive'
                        )}
                        title="Delete subcategory"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Search + view sort */}
        <div className="px-3 py-2 border-b border-panel-border flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
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
          <div className="relative flex-shrink-0" title="Sort view only — doesn't change the saved order">
            <ArrowUpDown className={cn('absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none', sortMode === 'manual' ? 'text-muted-foreground' : 'text-primary')} />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              aria-label="Sort items (view only)"
              className={cn(
                'h-[34px] pl-7 pr-6 text-xs rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer',
                sortMode === 'manual' ? 'border-input text-muted-foreground' : 'border-primary/50 text-foreground',
              )}
            >
              <option value="manual">Manual</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {viewItems.length === 0 && searchQuery ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No items match "{searchQuery}"
            </div>
          ) : null}
          {viewItems.map((item) => {
            const directIndex = directIndexOfItem(item.id);
            const isDirect = directIndex !== -1;
            const canDragItem = !isReadOnly && isDirect && !searchQuery.trim() && sortMode === 'manual';
            const isItemDragOver =
              isDirect &&
              itemDragOverIndex === directIndex &&
              itemDragIndex !== directIndex;
            return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              draggable={canDragItem}
              onDragStart={(e) => handleItemDragStart(e, directIndex)}
              onDragOver={(e) => handleItemDragOver(e, directIndex)}
              onDrop={(e) => handleItemDrop(e, directIndex)}
              onDragEnd={handleItemDragEnd}
              className={cn(
                "item-row flex items-center justify-between",
                selectedItemId === item.id && "selected",
                item.stockStatus === 'outOfStock' && "is-86",
                isItemDragOver && "ring-2 ring-primary ring-inset"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical
                  className={cn(
                    "w-3.5 h-3.5 text-muted-foreground flex-shrink-0",
                    canDragItem ? "cursor-grab active:cursor-grabbing" : "opacity-40 cursor-default"
                  )}
                />
                <span className="truncate">{shortenName(item.itemName)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  ${item.itemPrice.toFixed(2)}
                </span>
                {/* Show copy/duplicate button except when "All" is selected in subcategories
                    (items shown are from multiple categories, so modifying one is ambiguous) */}
                {!isReadOnly && !(activeSubcat === null && subcatRows.length > 0) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newId = duplicateItem(item.id);
                      if (newId) setSelectedItem(newId);
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Duplicate item"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Show remove button except when "All" is selected in subcategories
                    (prevents removing items from ambiguous multi-category context) */}
                {!isReadOnly && !(activeSubcat === null && subcatRows.length > 0) && (
                  <button
                    onClick={(e) => handleRemoveItemFromCategory(item.id, e)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove from category"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Add Item Buttons */}
        {!isReadOnly && (
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
        )}
      </div>

      {/* Add Items Modal */}
      <AddItemsModal
        isOpen={showAddItemsModal}
        onClose={() => setShowAddItemsModal(false)}
        categoryId={activeSubcat || category.id}
        categoryName={focusedCategory.categoryName}
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

      {/* Add subcategory to a category that has items — confirm the items will be removed */}
      <AlertDialog open={confirmAddSubcatWithItems !== null} onOpenChange={(open) => { if (!open) setConfirmAddSubcatWithItems(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Items from "{confirmAddSubcatWithItems?.categoryName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A category can hold either items or subcategories, not both. "{confirmAddSubcatWithItems?.categoryName}" currently has {confirmAddSubcatWithItems?.itemCount} item{confirmAddSubcatWithItems?.itemCount !== 1 ? 's' : ''}. Adding a subcategory will remove all {confirmAddSubcatWithItems?.itemCount !== 1 ? 'of those items' : 'of that item'} from this category (the item{confirmAddSubcatWithItems?.itemCount !== 1 ? 's' : ''} will not be deleted, just unassigned). Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAddSubcategoryAndClearItems}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Items & Add Subcategory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cannot add item - validation errors */}
      <AlertDialog open={cannotAddItemReason !== null} onOpenChange={(open) => { if (!open) setCannotAddItemReason(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Add Item</AlertDialogTitle>
            <AlertDialogDescription>
              {cannotAddItemReason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCannotAddItemReason(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
