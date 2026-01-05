import { useState, useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Search, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface AddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: number;
  categoryName: string;
}

export function AddItemsModal({ isOpen, onClose, categoryId, categoryName }: AddItemsModalProps) {
  const { items, categoryItems, addCategoryItem, getNextId } = useMenuStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  // Get item IDs already in this category
  const existingItemIds = useMemo(() => {
    return categoryItems
      .filter(ci => ci.categoryId === categoryId)
      .map(ci => ci.itemId);
  }, [categoryItems, categoryId]);

  // Filter items by search and exclude already-added items
  const availableItems = useMemo(() => {
    return items.filter(item => {
      // Exclude items already in the category
      if (existingItemIds.includes(item.id)) return false;
      
      // Filter by search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        return (
          item.itemName.toLowerCase().includes(query) ||
          item.posDisplayName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [items, existingItemIds, searchTerm]);

  const toggleItemSelection = (itemId: number) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleAddSelected = () => {
    const maxSortOrder = categoryItems
      .filter(ci => ci.categoryId === categoryId)
      .reduce((max, ci) => Math.max(max, ci.sortOrder), -1);

    selectedItemIds.forEach((itemId, index) => {
      addCategoryItem({
        id: getNextId('categories') + index, // Using categories as a proxy for unique IDs
        categoryId,
        itemId,
        sortOrder: maxSortOrder + 1 + index,
      });
    });

    // Reset and close
    setSelectedItemIds([]);
    setSearchTerm('');
    onClose();
  };

  const handleClose = () => {
    setSelectedItemIds([]);
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Items to {categoryName}</DialogTitle>
          <DialogDescription>
            Select existing items to add to this category
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Items List */}
        <ScrollArea className="h-[300px] border rounded-md">
          {availableItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
              {searchTerm
                ? `No items match "${searchTerm}"`
                : 'All items are already in this category'}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {availableItems.map(item => {
                const isSelected = selectedItemIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItemSelection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground"
                    )}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.itemName}</div>
                      <div className="text-xs text-muted-foreground">
                        ${item.itemPrice.toFixed(2)}
                        {item.stockStatus === 'outOfStock' && (
                          <span className="ml-2 text-destructive">(Out of Stock)</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            {selectedItemIds.length} item{selectedItemIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedItemIds.length === 0}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                selectedItemIds.length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              Add Selected
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

