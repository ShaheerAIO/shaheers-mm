import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import type { Item } from '@/types/menu';

const CHANNELS = [
  { key: 'visibilityPos' as const, label: 'POS' },
  { key: 'visibilityKiosk' as const, label: 'Kiosk' },
  { key: 'visibilityQr' as const, label: 'QR' },
  { key: 'visibilityWebsite' as const, label: 'Web' },
  { key: 'visibilityMobileApp' as const, label: 'App' },
  { key: 'visibilityDoordash' as const, label: 'DD' },
];

interface ItemsTableProps {
  categoryId: number | null;
  selectedItemIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

export function ItemsTable({ categoryId, selectedItemIds, onSelectionChange }: ItemsTableProps) {
  const { categories, categoryItems, items } = useMenuStore();
  const [filter, setFilter] = useState('');

  const category = categoryId != null ? categories.find((c) => c.id === categoryId) : null;

  // Collect all category IDs in scope (selected + its subcategories)
  const scopeCategoryIds = useMemo(() => {
    if (categoryId == null) return new Set<number>();
    const ids = new Set<number>([categoryId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of categories) {
        if (c.parentCategoryId != null && ids.has(c.parentCategoryId) && !ids.has(c.id)) {
          ids.add(c.id);
          changed = true;
        }
      }
    }
    return ids;
  }, [categoryId, categories]);

  const scopeItems = useMemo(() => {
    const itemIds = categoryItems
      .filter((ci) => scopeCategoryIds.has(ci.categoryId))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((ci) => ci.itemId);
    // Deduplicate while preserving order
    const seen = new Set<number>();
    const unique: number[] = [];
    for (const id of itemIds) {
      if (!seen.has(id)) { seen.add(id); unique.push(id); }
    }
    return unique
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is Item => i !== undefined);
  }, [categoryItems, scopeCategoryIds, items]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return scopeItems;
    const q = filter.toLowerCase();
    return scopeItems.filter(
      (i) =>
        i.itemName.toLowerCase().includes(q) ||
        i.posDisplayName?.toLowerCase().includes(q),
    );
  }, [scopeItems, filter]);

  const allFilteredIds = filtered.map((i) => i.id);
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedItemIds.has(id));
  const someSelected = allFilteredIds.some((id) => selectedItemIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedItemIds);
      allFilteredIds.forEach((id) => next.delete(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedItemIds);
      allFilteredIds.forEach((id) => next.add(id));
      onSelectionChange(next);
    }
  };

  const toggleItem = (id: number) => {
    const next = new Set(selectedItemIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  if (categoryId == null) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select a category to view its items
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: category?.color || '#71717a' }}
          />
          <h2 className="text-sm font-semibold truncate">
            {category?.posDisplayName || category?.categoryName || 'Category'}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            ({filtered.length} items)
          </span>
        </div>
        {selectedItemIds.size > 0 && (
          <span className="text-xs font-medium text-primary shrink-0">
            {selectedItemIds.size} selected
          </span>
        )}
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter items..."
            className="input-field w-full pl-7 text-xs h-7"
          />
        </div>
      </div>

      {/* Column headers */}
      <div className="px-4 py-1.5 border-b border-border shrink-0 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleAll}
          className="shrink-0 accent-primary cursor-pointer"
        />
        <span className="flex-1">Item</span>
        <span className="w-16 text-right">Price</span>
        <span className="w-16 text-center">Stock</span>
        <div className="flex gap-1">
          {CHANNELS.map((ch) => (
            <span key={ch.key} className="w-7 text-center">{ch.label}</span>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {scopeItems.length === 0 ? 'No items in this category' : 'No items match filter'}
          </p>
        ) : (
          filtered.map((item) => {
            const isChecked = selectedItemIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 border-b border-border/50 cursor-pointer select-none transition-colors text-xs',
                  isChecked ? 'bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleItem(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 accent-primary cursor-pointer"
                />
                <span className="flex-1 truncate font-medium text-foreground">
                  {item.posDisplayName || item.itemName}
                </span>
                <span className="w-16 text-right tabular-nums text-muted-foreground">
                  ${item.itemPrice.toFixed(2)}
                </span>
                <span className="w-16 text-center">
                  <span
                    className={cn(
                      'inline-block text-[10px] px-1.5 py-0.5 rounded font-medium',
                      item.stockStatus === 'outOfStock'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400',
                    )}
                  >
                    {item.stockStatus === 'outOfStock' ? 'Out' : 'In'}
                  </span>
                </span>
                <div className="flex gap-1">
                  {CHANNELS.map((ch) => (
                    <span
                      key={ch.key}
                      className={cn(
                        'w-7 h-5 rounded text-[9px] flex items-center justify-center font-semibold',
                        item[ch.key]
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                          : 'bg-muted text-muted-foreground/50',
                      )}
                    >
                      {item[ch.key] ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
