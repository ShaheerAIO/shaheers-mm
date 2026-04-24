import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import { ItemDetailPanel } from '@/components/menu-builder/ItemDetailPanel';
import { CreateModifierPanel } from '@/components/menu-builder/CreateModifierPanel';
import { CreateOptionPanel } from '@/components/menu-builder/CreateOptionPanel';
import { CategoryDetailPanel } from '@/components/categories/CategoryDetailPanel';
import { MenuDetailPanel } from '@/components/menu-builder/MenuDetailPanel';
import { cn } from '@/lib/utils';
import { RIGHT_PANEL_WIDTH_PX, CATEGORY_PANEL_WIDTH_PX } from '@/lib/rightPanelWidth';

const COLLAPSED_TAB_WIDTH = 36;

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
    editingMenuId,
    setEditingMenu,
    menus,
    viewMode,
  } = useMenuStore();

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse when entering pos-preview; auto-expand when returning to tree
  useEffect(() => {
    if (viewMode === 'pos-preview') {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  }, [viewMode]);

  const selectedItem = items.find(i => i.id === selectedItemId);
  const editingCategory = editingCategoryId != null
    ? categories.find(c => c.id === editingCategoryId) ?? null
    : null;
  const editingMenu = editingMenuId != null
    ? menus.find(m => m.id === editingMenuId) ?? null
    : null;

  const handleBackdropClick = () => {
    setIsCreatingOption(false);
    setIsCreatingModifier(false);
  };

  if (!selectedItem && !editingCategory && !editingMenu) return null;

  const inPreview = viewMode === 'pos-preview';
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
        {/* Menu Detail Panel */}
        {editingMenu && !selectedItem && !editingCategory && (
          <aside
            style={categoryPanelStyle}
            className="h-full bg-panel-bg border-l border-panel-border flex flex-col shrink-0"
          >
            <div className="flex items-center justify-between p-4 border-b border-panel-border flex-shrink-0">
              <span className="text-sm font-medium truncate">{editingMenu.menuName}</span>
              <button
                onClick={() => setEditingMenu(null)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MenuDetailPanel menu={editingMenu} />
            </div>
          </aside>
        )}

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

        {/* Level 1: Item Detail Panel */}
        {selectedItem && (
          inPreview && isCollapsed ? (
            /* Collapsed tab — ghost at rest, peeks opaque on hover */
            <aside
              style={{ width: COLLAPSED_TAB_WIDTH }}
              className="group h-full bg-panel-bg/0 hover:bg-panel-bg border-l border-panel-border/0 hover:border-panel-border flex flex-col items-center shrink-0 cursor-pointer select-none translate-x-5 hover:translate-x-0 opacity-0 hover:opacity-100 transition-all duration-200 ease-out"
              onClick={() => setIsCollapsed(false)}
              title="Expand item panel"
            >
              <div className="flex flex-col items-center pt-4 pb-3 gap-3 flex-1 min-h-0 w-full">
                <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div
                  className="flex-1 min-h-0 overflow-hidden"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight block truncate max-h-full">
                    {selectedItem.itemName}
                  </span>
                </div>
              </div>
            </aside>
          ) : (
            /* Full panel */
            <aside
              style={panelStyle}
              className={cn(
                'h-full bg-panel-bg border-l border-panel-border flex flex-col transition-all duration-300 shrink-0',
                (isCreatingModifier || isCreatingOption) && 'brightness-75',
              )}
            >
              <div className="flex items-center justify-between p-4 border-b border-panel-border flex-shrink-0">
                {inPreview ? (
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                    Collapse
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                )}
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
          )
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