import { useState, useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { X, Search, Plus, Trash2, Edit2, Check, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ModifierOption } from '@/types/menu';

interface OptionsLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OptionsLibraryModal({ isOpen, onClose }: OptionsLibraryModalProps) {
  const {
    modifierOptions,
    modifierModifierOptions,
    modifiers,
    addModifierOption,
    updateModifierOption,
    deleteModifierOption,
    getNextId,
  } = useMenuStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Create form state
  const [newOptionName, setNewOptionName] = useState('');
  const [newPosDisplayName, setNewPosDisplayName] = useState('');
  const [newIsStockAvailable, setNewIsStockAvailable] = useState(true);
  const [newIsSizeModifier, setNewIsSizeModifier] = useState(false);

  // Edit form state
  const [editOptionName, setEditOptionName] = useState('');
  const [editPosDisplayName, setEditPosDisplayName] = useState('');
  const [editIsStockAvailable, setEditIsStockAvailable] = useState(true);
  const [editIsSizeModifier, setEditIsSizeModifier] = useState(false);

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return modifierOptions;
    const query = searchTerm.toLowerCase();
    return modifierOptions.filter(o =>
      o.optionName.toLowerCase().includes(query) ||
      o.posDisplayName.toLowerCase().includes(query)
    );
  }, [modifierOptions, searchTerm]);

  // Get usage count for an option
  const getUsageCount = (optionId: number) => {
    return modifierModifierOptions.filter(mmo => mmo.modifierOptionId === optionId).length;
  };

  // Get modifiers that use this option
  const getModifiersUsingOption = (optionId: number) => {
    const modifierIds = modifierModifierOptions
      .filter(mmo => mmo.modifierOptionId === optionId)
      .map(mmo => mmo.modifierId);
    return modifiers.filter(m => modifierIds.includes(m.id));
  };

  const handleCreateOption = () => {
    if (!newOptionName.trim()) return;

    const newOption: ModifierOption = {
      id: getNextId('modifierOptions'),
      optionName: newOptionName.trim(),
      posDisplayName: newPosDisplayName.trim() || newOptionName.trim(),
      parentModifierId: 0,
      isStockAvailable: newIsStockAvailable,
      isSizeModifier: newIsSizeModifier,
    };

    addModifierOption(newOption);

    // Reset form
    setNewOptionName('');
    setNewPosDisplayName('');
    setNewIsStockAvailable(true);
    setNewIsSizeModifier(false);
    setShowCreateForm(false);
  };

  const startEditing = (option: ModifierOption) => {
    setEditingOptionId(option.id);
    setEditOptionName(option.optionName);
    setEditPosDisplayName(option.posDisplayName);
    setEditIsStockAvailable(option.isStockAvailable);
    setEditIsSizeModifier(option.isSizeModifier);
  };

  const saveEdit = () => {
    if (!editingOptionId || !editOptionName.trim()) return;

    updateModifierOption(editingOptionId, {
      optionName: editOptionName.trim(),
      posDisplayName: editPosDisplayName.trim() || editOptionName.trim(),
      isStockAvailable: editIsStockAvailable,
      isSizeModifier: editIsSizeModifier,
    });

    setEditingOptionId(null);
  };

  const cancelEdit = () => {
    setEditingOptionId(null);
  };

  const handleDeleteOption = (optionId: number) => {
    const usageCount = getUsageCount(optionId);
    if (usageCount > 0) {
      const confirmed = window.confirm(
        `This option is used by ${usageCount} modifier(s). Deleting it will remove it from all modifiers. Continue?`
      );
      if (!confirmed) return;
    }
    deleteModifierOption(optionId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Modifier Options Library
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Search and Create */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                showCreateForm
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <Plus className="w-4 h-4" />
              New Option
            </button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg border border-border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Option Name *</Label>
                  <input
                    type="text"
                    value={newOptionName}
                    onChange={(e) => setNewOptionName(e.target.value)}
                    placeholder="e.g., Extra Cheese"
                    className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">POS Display Name</Label>
                  <input
                    type="text"
                    value={newPosDisplayName}
                    onChange={(e) => setNewPosDisplayName(e.target.value)}
                    placeholder="Leave blank to use name"
                    className="w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="newInStock"
                    checked={newIsStockAvailable}
                    onCheckedChange={setNewIsStockAvailable}
                  />
                  <Label htmlFor="newInStock" className="text-xs">In Stock</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="newSizeModifier"
                    checked={newIsSizeModifier}
                    onCheckedChange={setNewIsSizeModifier}
                  />
                  <Label htmlFor="newSizeModifier" className="text-xs">Size Modifier</Label>
                </div>
                <div className="flex-1" />
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateOption}
                  disabled={!newOptionName.trim()}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    newOptionName.trim()
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* Options List */}
          <ScrollArea className="flex-1 border rounded-md">
            <div className="min-w-full">
              {/* Header */}
              <div className="sticky top-0 bg-muted/80 backdrop-blur-sm border-b px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground">
                <div className="col-span-4">Option Name</div>
                <div className="col-span-3">POS Display</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Used By</div>
                <div className="col-span-1"></div>
              </div>

              {/* Rows */}
              {filteredOptions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {searchTerm ? `No options match "${searchTerm}"` : 'No modifier options yet. Create one to get started!'}
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isEditing = editingOptionId === option.id;
                  const usageCount = getUsageCount(option.id);

                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "px-4 py-2.5 grid grid-cols-12 gap-2 items-center border-b transition-colors",
                        isEditing ? "bg-primary/5" : "hover:bg-muted/30"
                      )}
                    >
                      {isEditing ? (
                        <>
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={editOptionName}
                              onChange={(e) => setEditOptionName(e.target.value)}
                              className="w-full px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              autoFocus
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={editPosDisplayName}
                              onChange={(e) => setEditPosDisplayName(e.target.value)}
                              className="w-full px-2 py-1 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div className="col-span-2 flex justify-center gap-2">
                            <Switch
                              checked={editIsStockAvailable}
                              onCheckedChange={setEditIsStockAvailable}
                            />
                          </div>
                          <div className="col-span-2 text-center text-sm text-muted-foreground">
                            {usageCount}
                          </div>
                          <div className="col-span-1 flex justify-end gap-1">
                            <button
                              onClick={saveEdit}
                              className="p-1 text-green-600 hover:bg-green-500/10 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-muted-foreground hover:bg-muted rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-4 text-sm font-medium truncate">
                            {option.optionName}
                          </div>
                          <div className="col-span-3 text-sm text-muted-foreground truncate">
                            {option.posDisplayName}
                          </div>
                          <div className="col-span-2 flex justify-center">
                            {option.isStockAvailable ? (
                              <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded">
                                In Stock
                              </span>
                            ) : (
                              <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
                                Out
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded",
                              usageCount > 0 ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground"
                            )}>
                              {usageCount} modifier{usageCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-end gap-1">
                            <button
                              onClick={() => startEditing(option)}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ opacity: 1 }}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOption(option.id)}
                              className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Summary */}
          <div className="mt-3 text-xs text-muted-foreground">
            {modifierOptions.length} total option{modifierOptions.length !== 1 ? 's' : ''}
            {searchTerm && ` • ${filteredOptions.length} shown`}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

