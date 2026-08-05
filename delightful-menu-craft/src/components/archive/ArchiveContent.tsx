import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import type { Category, Item } from '@/types/menu';
import { Archive, Upload, Trash2, PackageOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

/** Human-readable "Menu / Parent / Category" path for a leaf category. */
function categoryPath(
  category: Category,
  categoriesById: Map<number, Category>,
  menuNameById: Map<number, string>,
): string {
  const parts: string[] = [category.categoryName];
  const seen = new Set<number>();
  let cur = category.parentCategoryId;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    const parent = categoriesById.get(cur);
    if (!parent) break;
    parts.unshift(parent.categoryName);
    cur = parent.parentCategoryId;
  }
  const firstMenuId = category.menuIds
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .find((n) => !isNaN(n));
  const menuName = firstMenuId != null ? menuNameById.get(firstMenuId) : undefined;
  if (menuName) parts.unshift(menuName);
  return parts.join(' / ');
}

export function ArchiveContent() {
  const {
    items,
    categories,
    categoryItems,
    menus,
    isDataLoaded,
    addCategoryItem,
    deleteItem,
    setSelectedItem,
    selectedItemId,
  } = useMenuStore();

  const [search, setSearch] = useState('');
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  const mappedItemIds = useMemo(
    () => new Set(categoryItems.map((ci) => ci.itemId)),
    [categoryItems],
  );

  const archivedItems = useMemo(() => {
    const base = items
      .filter((item) => !mappedItemIds.has(item.id))
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        item.itemName.toLowerCase().includes(q) ||
        item.posDisplayName.toLowerCase().includes(q),
    );
  }, [items, mappedItemIds, search]);

  // Items can only live in leaf categories (categories without subcategories) —
  // same rule enforced by AddItemsModal.
  const leafCategoryOptions = useMemo(() => {
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const menuNameById = new Map(menus.map((m) => [m.id, m.menuName]));
    const parentIds = new Set(
      categories.map((c) => c.parentCategoryId).filter((id): id is number => id != null),
    );
    return categories
      .filter((c) => !parentIds.has(c.id))
      .map((c) => ({ id: c.id, path: categoryPath(c, categoriesById, menuNameById) }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [categories, menus]);

  const handleAssign = (itemId: number, categoryId: number) => {
    const siblingItems = categoryItems.filter((ci) => ci.categoryId === categoryId);
    const maxSortOrder = siblingItems.reduce((max, ci) => Math.max(max, ci.sortOrder), -1);
    const nextCategoryItemId = Math.max(0, ...categoryItems.map((ci) => ci.id)) + 1;
    addCategoryItem({
      id: nextCategoryItemId,
      categoryId,
      itemId,
      sortOrder: maxSortOrder + 1,
    });
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      if (selectedItemId === itemToDelete.id) setSelectedItem(null);
      deleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Data Loaded</h3>
          <p className="text-sm text-muted-foreground">
            Import an Excel file to view the archive
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Archive</h2>
          {archivedItems.length > 0 && (
            <span className="px-1.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold tabular-nums">
              {archivedItems.length}
            </span>
          )}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-52 h-8 text-xs"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Items that aren't mapped to any category live here. They stay in your data — assign
        one back to a category to bring it back into your menus, or delete it permanently.
      </p>

      {archivedItems.length > 0 ? (
        <div className="space-y-1">
          {archivedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50"
            >
              <button
                type="button"
                onClick={() => setSelectedItem(item.id)}
                className="text-sm truncate flex-1 text-left hover:underline"
                title="View item details"
              >
                {item.itemName}
                <span className="text-[10px] text-muted-foreground ml-1">
                  (${item.itemPrice.toFixed(2)})
                </span>
                {item.stockStatus === 'outOfStock' && (
                  <span className="ml-2 text-[10px] text-destructive">(Out of Stock)</span>
                )}
              </button>
              <select
                value=""
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  if (!isNaN(id)) handleAssign(item.id, id);
                }}
                className="input-field h-8 py-0 text-xs w-52 shrink-0"
                disabled={leafCategoryOptions.length === 0}
              >
                <option value="" disabled>
                  {leafCategoryOptions.length === 0 ? 'No categories' : 'Assign to category...'}
                </option>
                {leafCategoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.path}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setItemToDelete(item)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="Delete permanently"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {search.trim() ? (
            <>
              <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No matching archived items</p>
            </>
          ) : (
            <>
              <PackageOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>The archive is empty</p>
              <p className="text-sm mt-1">
                Items removed from a category (without being deleted) will show up here.
              </p>
            </>
          )}
        </div>
      )}

      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{itemToDelete?.itemName}" permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item from your data entirely, including any modifiers or station
              assignments linked to it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
