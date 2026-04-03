import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import { Upload, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Category } from '@/types/menu';

// Channel options for POS preview
const CHANNELS = [
  { id: 'onPrem', name: 'Dine-in (On-Premise)' },
  { id: 'offPrem', name: 'Delivery (Off-Premise)' },
];

// Color palette for new categories
const CATEGORY_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export function POSPreview() {
  const { 
    categories, 
    items,
    categoryItems, 
    selectedMenuId,
    selectedItemId,
    setSelectedItem,
    isDataLoaded,
    addCategory,
    getNextId,
  } = useMenuStore();
  
  const [selectedChannel, setSelectedChannel] = useState<'onPrem' | 'offPrem'>('onPrem');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  // Get root categories for selected menu
  const rootCategories = useMemo(() => {
    if (!selectedMenuId) return [];
    return categories
      .filter(c => {
        const menuIdList = c.menuIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
        return menuIdList.includes(selectedMenuId) && !c.parentCategoryId;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, selectedMenuId]);

  // Get items for active category or all items
  const displayItems = useMemo(() => {
    if (!selectedMenuId) return [];
    
    let categoryIds: number[] = [];
    
    if (activeCategory) {
      // Get all subcategory IDs too
      const subcats = categories.filter(c => c.parentCategoryId === activeCategory);
      categoryIds = [activeCategory, ...subcats.map(s => s.id)];
    } else {
      // Get all category IDs for this menu
      categoryIds = rootCategories.map(c => c.id);
      rootCategories.forEach(c => {
        const subcats = categories.filter(sc => sc.parentCategoryId === c.id);
        categoryIds.push(...subcats.map(s => s.id));
      });
    }
    
    // Get items that belong to these categories via categoryItems join table
    const itemIds = categoryItems
      .filter(ci => categoryIds.includes(ci.categoryId))
      .map(ci => ci.itemId);
    
    return items
      .filter(i => itemIds.includes(i.id))
      .sort((a, b) => {
        // Sort by the order in categoryItems
        const aOrder = categoryItems.find(ci => ci.itemId === a.id)?.sortOrder || 0;
        const bOrder = categoryItems.find(ci => ci.itemId === b.id)?.sortOrder || 0;
        return aOrder - bOrder;
      });
  }, [items, categories, categoryItems, activeCategory, selectedMenuId, rootCategories]);

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !selectedMenuId) return;

    const newCategoryId = getNextId('categories');
    const newCategory: Category = {
      id: newCategoryId,
      categoryName: newCategoryName.trim(),
      posDisplayName: newCategoryName.trim(),
      menuIds: selectedMenuId.toString(),
      parentCategoryId: 0,
      sortOrder: rootCategories.length,
      categoryType: 'Regular',
      picture: '',
      color: newCategoryColor,
      inheritFromParent: false,
      isSubcategoryStyle: false,
    };

    addCategory(newCategory);
    setNewCategoryName('');
    setNewCategoryColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
    setShowAddCategory(false);
  };

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-[hsl(var(--pos-bg))] rounded-lg">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Data Loaded</h3>
          <p className="text-sm text-muted-foreground">
            Import an Excel file to preview POS view
          </p>
        </div>
      </div>
    );
  }

  if (!selectedMenuId) {
    return (
      <div className="flex items-center justify-center h-full bg-[hsl(var(--pos-bg))] rounded-lg">
        <div className="text-center text-muted-foreground">
          <p>Select a menu to preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 bg-[hsl(var(--pos-bg))] rounded-lg">
      {/* Channel Selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-[hsl(var(--pos-text-muted))]">Channel:</span>
        <Select value={selectedChannel} onValueChange={(v) => setSelectedChannel(v as 'onPrem' | 'offPrem')}>
          <SelectTrigger className="w-48 bg-[hsl(var(--pos-card))] border-[hsl(var(--pos-card-hover))] text-[hsl(var(--pos-text))]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(var(--pos-card))] border-[hsl(var(--pos-card-hover))]">
            {CHANNELS.map((channel) => (
              <SelectItem 
                key={channel.id} 
                value={channel.id}
                className="text-[hsl(var(--pos-text))] focus:bg-[hsl(var(--pos-accent))] focus:text-white"
              >
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Buttons */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            "flex flex-col items-center justify-center p-3 rounded-lg min-w-[100px] min-h-[60px] transition-all duration-150 cursor-pointer",
            "bg-[hsl(var(--pos-card))] border border-[hsl(var(--pos-card-hover))] text-[hsl(var(--pos-text))]",
            "hover:bg-[hsl(var(--pos-card-hover))]",
            !activeCategory && "border-[hsl(var(--pos-accent))] bg-[hsl(var(--pos-accent))] text-white"
          )}
        >
          <span className="text-sm font-medium">All</span>
        </button>
        {rootCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            style={{ backgroundColor: category.color || undefined }}
            className={cn(
              "flex flex-col items-center justify-center p-3 rounded-lg min-w-[100px] min-h-[60px] transition-all duration-150 cursor-pointer",
              "border border-[hsl(var(--pos-card-hover))] text-white",
              "hover:opacity-90",
              activeCategory === category.id && "ring-2 ring-white ring-offset-2 ring-offset-[hsl(var(--pos-bg))]",
              !category.color && "bg-[hsl(var(--pos-card))] text-[hsl(var(--pos-text))]"
            )}
          >
            <span className="text-sm font-medium">{category.categoryName}</span>
          </button>
        ))}
        {/* Add Category Button */}
        <button
          onClick={() => setShowAddCategory(true)}
          className={cn(
            "flex flex-col items-center justify-center p-3 rounded-lg min-w-[60px] min-h-[60px] transition-all duration-150 cursor-pointer",
            "bg-[hsl(var(--pos-card))] border-2 border-dashed border-[hsl(var(--pos-card-hover))] text-[hsl(var(--pos-text-muted))]",
            "hover:bg-[hsl(var(--pos-card-hover))] hover:border-[hsl(var(--pos-accent))] hover:text-[hsl(var(--pos-text))]"
          )}
          title="Add new category"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Item Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {displayItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item.id)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-lg min-h-[80px] transition-all duration-150 cursor-pointer",
                "bg-[hsl(var(--pos-card))] border border-[hsl(var(--pos-card-hover))] text-[hsl(var(--pos-text))]",
                "hover:bg-[hsl(var(--pos-card-hover))] hover:border-[hsl(var(--pos-accent))]",
                selectedItemId === item.id && "ring-2 ring-[hsl(var(--pos-accent))] border-[hsl(var(--pos-accent))] bg-[hsl(var(--pos-card-hover))]",
                item.stockStatus !== 'inStock' && "opacity-50 bg-red-900/30 border-red-700/50"
              )}
            >
              <span className={cn(
                "text-sm font-medium text-center text-[hsl(var(--pos-text))]",
                item.stockStatus !== 'inStock' && "line-through"
              )}>
                {shortenName(item.posDisplayName || item.itemName)}
              </span>
              <span className="text-xs text-[hsl(var(--pos-accent))] mt-1 font-semibold">
                ${item.itemPrice.toFixed(2)}
              </span>
              {item.stockStatus !== 'inStock' && (
                <span className="text-xs text-red-400 mt-1">86'd</span>
              )}
            </div>
          ))}
        </div>

        {displayItems.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No items to display
          </div>
        )}
      </div>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category for this menu
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="e.g., Appetizers, Main Course"
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label>Category Color</Label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCategoryColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      newCategoryColor === color && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  newCategoryName.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                Add Category
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
