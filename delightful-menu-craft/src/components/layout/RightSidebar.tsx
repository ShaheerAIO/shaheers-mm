import { X, ChevronLeft } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import { ItemDetailPanel } from '@/components/menu-builder/ItemDetailPanel';
import { CreateModifierPanel } from '@/components/menu-builder/CreateModifierPanel';
import { CreateOptionPanel } from '@/components/menu-builder/CreateOptionPanel';
import { cn } from '@/lib/utils';

export function RightSidebar() {
  const {
    selectedItemId,
    setSelectedItem,
    items,
    isCreatingModifier,
    isCreatingOption,
    setIsCreatingModifier,
    setIsCreatingOption,
  } = useMenuStore();

  const selectedItem = items.find(i => i.id === selectedItemId);
  const isOpen = !!selectedItem;

  const handleBackdropClick = () => {
    setIsCreatingOption(false);
    setIsCreatingModifier(false);
  };

  if (!selectedItem) return null;

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
        {/* Level 1: Item Detail Panel - always visible when item selected */}
        <aside className={cn(
          "w-[320px] h-full bg-panel-bg border-l border-panel-border flex flex-col transition-all duration-300",
          (isCreatingModifier || isCreatingOption) && "brightness-75"
        )}>
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

        {/* Level 2: Create Modifier Panel */}
        {isCreatingModifier && (
          <aside className={cn(
            "w-[320px] h-full bg-panel-bg border-l border-panel-border flex flex-col transition-all duration-300",
            isCreatingOption && "brightness-75"
          )}>
            <CreateModifierPanel itemId={selectedItem.id} />
          </aside>
        )}

        {/* Level 3: Create Option Panel */}
        {isCreatingOption && (
          <aside className="w-[320px] h-full bg-panel-bg border-l border-panel-border flex flex-col">
            <CreateOptionPanel />
          </aside>
        )}
      </div>
    </>
  );
}