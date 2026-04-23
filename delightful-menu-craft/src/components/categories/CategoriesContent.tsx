import { useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { CategoryTree } from './CategoryTree';
import { ItemsTable } from './ItemsTable';
import { CategoryDetailPanel } from './CategoryDetailPanel';
import { BulkEditPanel } from './BulkEditPanel';

export function CategoriesContent() {
  const { categories } = useMenuStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());

  const handleSelectCategory = (id: number) => {
    setSelectedCategoryId(id);
    setSelectedItemIds(new Set());
  };

  const selectedCategory = selectedCategoryId != null
    ? categories.find((c) => c.id === selectedCategoryId) ?? null
    : null;

  const showBulkPanel = selectedItemIds.size > 0;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left: category tree */}
      <div className="w-[220px] shrink-0 border-r border-border flex flex-col min-h-0">
        <CategoryTree
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
        />
      </div>

      {/* Center: items table */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 border-r border-border">
        <ItemsTable
          categoryId={selectedCategoryId}
          selectedItemIds={selectedItemIds}
          onSelectionChange={setSelectedItemIds}
        />
      </div>

      {/* Right: contextual panel */}
      <div className="w-[280px] shrink-0 flex flex-col min-h-0">
        {showBulkPanel ? (
          <BulkEditPanel
            selectedItemIds={selectedItemIds}
            onClearSelection={() => setSelectedItemIds(new Set())}
          />
        ) : selectedCategory ? (
          <CategoryDetailPanel category={selectedCategory} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
            Select a category to edit its settings, or check items to bulk-edit them
          </div>
        )}
      </div>
    </div>
  );
}
