import { X, ChevronLeft } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import { ItemDetailPanel } from '@/components/menu-builder/ItemDetailPanel';
import { CreateModifierPanel } from '@/components/menu-builder/CreateModifierPanel';
import { CreateOptionPanel } from '@/components/menu-builder/CreateOptionPanel';
import { CategoryDetailPanel } from '@/components/categories/CategoryDetailPanel';
import { cn } from '@/lib/utils';
import { RIGHT_PANEL_WIDTH_PX, CATEGORY_PANEL_WIDTH_PX } from '@/lib/rightPanelWidth';

export function RightSidebar() {
  const {
    selectedItemId,
    setSelectedItem,
    items,
    isCreatingModifier,
    isCreatingOption,
    setIsCreatingModifier,
    setIsCreatingOption,
    editingCategoryId,
    setEditingCategory,
    categories,
  } = useMenuStore();

  const selectedItem = items.find(i => i.id === selectedItemId);
  const editingCategory = editingCategoryId != null
    ? categories.find(c => c.id === editingCategoryId) ?? null
    : null;

  const handleBackdropClick = () => {
    setIsCreatingOption(false);
    setIsCreatingModifier(false);
  };

  if (!selectedItem && !editingCategory) return null;

  const panelStyle = { width: RIGHT_PANEL_WIDTH_PX } as const;
  const categoryPanelStyle = { width: CATEGORY_PANEL_WIDTH_PX } as const;

  return (
    <>
      {/* Backdrop overlay - only when nested panels are open */}
      {(isCreatingModifier || isCreatingOption) && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={handleBackdropClick}
        />
      )}

      {/* Sidebars container - sits on the right, panels stack left-to-right */}
      <div className="fixed top-0 right-0 h-screen flex z-50">
        {/* Category Detail Panel - shown when editing a category and no item selected */}
        {editingCategory && !selectedItem && (
          <aside
            style={categoryPanelStyle}
            className="h-full bg-panel-bg border-l border-panel-border flex flex-col shrink-0"
          >
            <div className="flex items-center justify-between p-4 border-b border-panel-border flex-shrink-0">
              <button
                onClick={() => setEditingCategory(null)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setEditingCategory(null)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <CategoryDetailPanel category={editingCategory} />
            </div>
          </aside>
        )}

        {/* Level 1: Item Detail Panel - always visible when item selected */}
        {selectedItem && (
        <aside
          style={panelStyle}
          className={cn(
            'h-full bg-panel-bg border-l border-panel-border flex flex-col transition-all duration-300 shrink-0',
            (isCreatingModifier || isCreatingOption) && 'brightness-75',
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-panel-border flex-shrink-0">
            <button
              onClick={() => setSelectedItem(null)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => setSelectedItem(null)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ItemDetailPanel item={selectedItem} />
          </div>
        </aside>
        )}

        {/* Level 2: Create Modifier Panel */}
        {isCreatingModifier && selectedItem && (
          <aside
            style={panelStyle}
            className={cn(
              'h-full bg-panel-bg border-l border-panel-border flex flex-col transition-all duration-300 shrink-0',
              isCreatingOption && 'brightness-75',
            )}
          >
            <CreateModifierPanel itemId={selectedItem.id} />
          </aside>
        )}

        {/* Level 3: Create Option Panel */}
        {isCreatingOption && (
          <aside
            style={panelStyle}
            className="h-full bg-panel-bg border-l border-panel-border flex flex-col shrink-0"
          >
            <CreateOptionPanel />
          </aside>
        )}
      </div>
    </>
  );
}