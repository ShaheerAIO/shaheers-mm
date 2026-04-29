import { useState, useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface StationItemsModalProps {
  stationId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function StationItemsModal({ stationId, isOpen, onClose }: StationItemsModalProps) {
  const { items, stations, bulkSetItemsForStation } = useMenuStore();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const stationLabel = `Station ${stationId}`;

  // Initialize selected items when modal opens or station/items change
  const initialSelectedIds = useMemo(() => {
    const set = new Set<number>();
    items.forEach((item) => {
      const ids = item.stationIds
        ? item.stationIds
            .split(',')
            .map((id) => parseInt(id.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0)
        : [];
      if (ids.includes(stationId)) {
        set.add(item.id);
      }
    });
    return set;
  }, [items, stationId]);

  // Keep local state in sync with current data when opened
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      return;
    }
    setSelectedIds(new Set(initialSelectedIds));
    setSearch('');
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item =>
      item.itemName.toLowerCase().includes(q) ||
      item.posDisplayName.toLowerCase().includes(q)
    );
  }, [items, search]);

  const toggleItem = (itemId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allVisibleIds = filteredItems.map(i => i.id);
    setSelectedIds(new Set(allVisibleIds));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = () => {
    bulkSetItemsForStation(stationId, Array.from(selectedIds));
    onClose();
  };

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Items for {stationLabel}</DialogTitle>
          <DialogDescription>
            Select which items should be assigned to this station.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3">
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
          <span>{filteredItems.length} items</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="hover:text-foreground"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-2">
            {filteredItems.map(item => (
              <label
                key={item.id}
                className={cn(
                  "flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-1",
                  selectedIds.has(item.id) && "bg-primary/5"
                )}
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <span className="truncate">
                  {item.itemName}
                  <span className="text-xs text-muted-foreground ml-1">
                    (${item.itemPrice.toFixed(2)})
                  </span>
                </span>
              </label>
            ))}
            {filteredItems.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No items match "{search}"
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save ({selectedCount})
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


