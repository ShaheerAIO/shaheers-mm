import { useState, useMemo, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Trash2, Save, RotateCcw, Check } from 'lucide-react';
import type { Item } from '@/types/menu';
import {
  Select,
  SelectContent,
  SelectItem as SelectOption,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ItemDetailPanelProps {
  item: Item;
}

interface DraftState {
  itemName: string;
  posDisplayName: string;
  itemPrice: number;
  itemDescription: string;
  stockStatus: string;
  inheritModifiersFromCategory: boolean;
  preparationTime: number;
  calories: number;
}

export function ItemDetailPanel({ item }: ItemDetailPanelProps) {
  const {
    updateItem,
    modifiers,
    modifierOptions,
    modifierModifierOptions,
    itemModifiers,
    addItemModifier,
    removeItemModifier,
    tags,
    allergens,
    setIsCreatingModifier,
  } = useMenuStore();
  
  // Draft state for all editable fields
  const [draft, setDraft] = useState<DraftState>({
    itemName: item.itemName,
    posDisplayName: item.posDisplayName,
    itemPrice: item.itemPrice,
    itemDescription: item.itemDescription,
    stockStatus: item.stockStatus,
    inheritModifiersFromCategory: item.inheritModifiersFromCategory,
    preparationTime: item.preparationTime,
    calories: item.calories,
  });
  
  const [priceInput, setPriceInput] = useState(item.itemPrice.toFixed(2));
  const [pendingModifierIds, setPendingModifierIds] = useState<number[]>([]);
  const [pendingRemovedModifierIds, setPendingRemovedModifierIds] = useState<number[]>([]);
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  // Reset draft state when item changes
  useEffect(() => {
    setDraft({
      itemName: item.itemName,
      posDisplayName: item.posDisplayName,
      itemPrice: item.itemPrice,
      itemDescription: item.itemDescription,
      stockStatus: item.stockStatus,
      inheritModifiersFromCategory: item.inheritModifiersFromCategory,
      preparationTime: item.preparationTime,
      calories: item.calories,
    });
    setPriceInput(item.itemPrice.toFixed(2));
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);
  }, [item.id]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return (
      draft.itemName !== item.itemName ||
      draft.posDisplayName !== item.posDisplayName ||
      draft.itemPrice !== item.itemPrice ||
      draft.itemDescription !== item.itemDescription ||
      draft.stockStatus !== item.stockStatus ||
      draft.inheritModifiersFromCategory !== item.inheritModifiersFromCategory ||
      draft.preparationTime !== item.preparationTime ||
      draft.calories !== item.calories ||
      pendingModifierIds.length > 0 ||
      pendingRemovedModifierIds.length > 0
    );
  }, [draft, item, pendingModifierIds, pendingRemovedModifierIds]);

  const handleSave = () => {
    // Save item changes
    updateItem(item.id, {
      itemName: draft.itemName,
      posDisplayName: draft.posDisplayName,
      itemPrice: draft.itemPrice,
      itemDescription: draft.itemDescription,
      stockStatus: draft.stockStatus,
      inheritModifiersFromCategory: draft.inheritModifiersFromCategory,
      preparationTime: draft.preparationTime,
      calories: draft.calories,
    });

    // Save pending modifier additions
    pendingModifierIds.forEach((modifierId) => {
      addItemModifier({
        modifierId: modifierId,
        itemId: item.id,
        sortOrder: attachedModifierIds.length + pendingModifierIds.indexOf(modifierId),
      });
    });

    // Save pending modifier removals
    pendingRemovedModifierIds.forEach((modifierId) => {
      removeItemModifier(modifierId, item.id);
    });

    // Clear pending changes
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);

    // Show save notification
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  const handleDiscard = () => {
    setDraft({
      itemName: item.itemName,
      posDisplayName: item.posDisplayName,
      itemPrice: item.itemPrice,
      itemDescription: item.itemDescription,
      stockStatus: item.stockStatus,
      inheritModifiersFromCategory: item.inheritModifiersFromCategory,
      preparationTime: item.preparationTime,
      calories: item.calories,
    });
    setPriceInput(item.itemPrice.toFixed(2));
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);
  };

  const handlePriceChange = (value: string) => {
    setPriceInput(value);
    const price = parseFloat(value);
    if (!isNaN(price) && price >= 0) {
      setDraft(d => ({ ...d, itemPrice: price }));
    }
  };

  // Get modifiers attached to this item via itemModifiers join table
  const attachedModifierIds = useMemo(() => {
    return itemModifiers
      .filter(im => im.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(im => im.modifierId)
      .filter(id => !pendingRemovedModifierIds.includes(id));
  }, [itemModifiers, item.id, pendingRemovedModifierIds]);

  // Combine saved and pending modifiers
  const allAttachedModifierIds = useMemo(() => {
    return [...attachedModifierIds, ...pendingModifierIds];
  }, [attachedModifierIds, pendingModifierIds]);

  const attachedModifiers = useMemo(() => {
    return allAttachedModifierIds
      .map(id => modifiers.find(m => m.id === id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);
  }, [allAttachedModifierIds, modifiers]);

  // Get available modifiers (not yet attached, including pending)
  const availableModifiers = useMemo(() => {
    return modifiers.filter(m => !allAttachedModifierIds.includes(m.id));
  }, [modifiers, allAttachedModifierIds]);

  // Get options for a modifier
  const getModifierOptions = (modifierId: number) => {
    const optionAssignments = modifierModifierOptions
      .filter(mmo => mmo.modifierId === modifierId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    
    return optionAssignments.map(mmo => {
      const option = modifierOptions.find(o => o.id === mmo.modifierOptionId);
      return {
        ...mmo,
        option,
      };
    });
  };

  const handleAddModifier = (modifierId: string) => {
    const id = parseInt(modifierId);
    if (isNaN(id)) return;
    
    // Add to pending list instead of immediately saving
    if (!pendingModifierIds.includes(id) && !attachedModifierIds.includes(id)) {
      setPendingModifierIds([...pendingModifierIds, id]);
    }
  };

  const handleRemoveModifier = (modifierId: number) => {
    // If it's a pending addition, just remove from pending
    if (pendingModifierIds.includes(modifierId)) {
      setPendingModifierIds(pendingModifierIds.filter(id => id !== modifierId));
    } else {
      // If it's already saved, add to pending removals
      setPendingRemovedModifierIds([...pendingRemovedModifierIds, modifierId]);
    }
  };

  // Parse tag IDs
  const itemTagIds = item.tagIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
  const itemTags = tags.filter(t => itemTagIds.includes(t.id));

  // Parse allergen IDs
  const itemAllergenIds = item.allergenIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
  const itemAllergens = allergens.filter(a => itemAllergenIds.includes(a.id));

  return (
    <div className="flex flex-col h-full">
      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-600 text-xs font-medium">
          You have unsaved changes
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {/* Item Name */}
        <div className="space-y-2">
          <Label className="section-header">Item Name</Label>
          <input
            type="text"
            value={draft.itemName}
            onChange={(e) => setDraft(d => ({ 
              ...d, 
              itemName: e.target.value,
              posDisplayName: e.target.value 
            }))}
            className="input-field text-lg font-semibold w-full"
            placeholder="Item name"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="section-header">Description</Label>
          <textarea
            value={draft.itemDescription}
            onChange={(e) => setDraft(d => ({ ...d, itemDescription: e.target.value }))}
            className="input-field w-full min-h-[80px] resize-none"
            placeholder="Item description (optional)"
          />
        </div>

        {/* Base Price */}
        <div className="space-y-2">
          <Label className="section-header">Price</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <input
              type="text"
              value={priceInput}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="input-field w-24"
            />
          </div>
        </div>

        {/* Stock Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="stockStatus" className="text-sm">In Stock</Label>
            <Switch
              id="stockStatus"
              checked={draft.stockStatus === 'inStock'}
              onCheckedChange={(checked) => setDraft(d => ({ 
                ...d, 
                stockStatus: checked ? 'inStock' : 'outOfStock' 
              }))}
            />
          </div>
        </div>

        {/* Modifiers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="section-header">Modifiers</Label>
            <div className="flex gap-2">
              {availableModifiers.length > 0 && (
                <Select onValueChange={handleAddModifier}>
                  <SelectTrigger className="w-32">
                    <span className="text-xs flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      Add
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableModifiers.map((mod) => (
                      <SelectOption key={mod.id} value={mod.id.toString()}>
                        {mod.modifierName}
                      </SelectOption>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <button
                className="btn-add"
                onClick={() => setIsCreatingModifier(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>
          </div>
          
          {attachedModifiers.length > 0 ? (
            <Accordion type="multiple" className="space-y-1">
              {attachedModifiers.map((modifier) => {
                const options = getModifierOptions(modifier.id);
                const isPending = pendingModifierIds.includes(modifier.id);
                const isPendingRemoval = pendingRemovedModifierIds.includes(modifier.id);
                return (
                  <AccordionItem 
                    key={modifier.id} 
                    value={modifier.id.toString()} 
                    className={cn(
                      "border rounded-md",
                      isPending && "border-green-500/50 bg-green-500/5",
                      isPendingRemoval && "opacity-50"
                    )}
                  >
                    <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="flex items-center gap-2">
                          <span>{modifier.modifierName}</span>
                          {isPending && (
                            <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
                              New
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveModifier(modifier.id);
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground mb-2">
                          {modifier.isOptional || 'Required'} • 
                          Min: {modifier.minSelector} / Max: {modifier.noMaxSelection ? '∞' : modifier.maxSelector}
                        </div>
                        {options.map((opt) => (
                          <div key={opt.modifierOptionId} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span>{opt.option?.optionName || opt.optionDisplayName}</span>
                              {opt.isDefaultSelected && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground">
                              {opt.maxLimit > 0 ? `+$${opt.maxLimit.toFixed(2)}` : '$0.00'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground">No modifiers attached</p>
          )}
        </div>

        {/* Tags */}
        {itemTags.length > 0 && (
          <div className="space-y-2">
            <Label className="section-header">Tags</Label>
            <div className="flex flex-wrap gap-1">
              {itemTags.map(tag => (
                <span 
                  key={tag.id} 
                  className="text-xs bg-muted px-2 py-1 rounded"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Allergens */}
        {itemAllergens.length > 0 && (
          <div className="space-y-2">
            <Label className="section-header">Allergens</Label>
            <div className="flex flex-wrap gap-1">
              {itemAllergens.map(allergen => (
                <span 
                  key={allergen.id} 
                  className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded"
                >
                  {allergen.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Inherit Modifiers from Category</Label>
            <Switch
              checked={draft.inheritModifiersFromCategory}
              onCheckedChange={(checked) => setDraft(d => ({ ...d, inheritModifiersFromCategory: checked }))}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prep Time (min)</span>
            <input
              type="number"
              min={0}
              value={draft.preparationTime}
              onChange={(e) => setDraft(d => ({ ...d, preparationTime: parseInt(e.target.value) || 0 }))}
              className="input-field w-20 text-right"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Calories</span>
            <input
              type="number"
              min={0}
              value={draft.calories}
              onChange={(e) => setDraft(d => ({ ...d, calories: parseInt(e.target.value) || 0 }))}
              className="input-field w-20 text-right"
            />
          </div>
        </div>
      </div>
      
      {/* Save/Discard buttons */}
      <div className={cn(
        "p-4 border-t border-border bg-panel-bg flex gap-2 transition-opacity",
        hasChanges ? "opacity-100" : "opacity-50 pointer-events-none"
      )}>
        <button
          onClick={handleDiscard}
          disabled={!hasChanges}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      {/* Save Confirmation Notification */}
      {showSaveNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-slide-up">
            <Check className="w-5 h-5" />
            <span className="font-medium">Changes saved successfully</span>
          </div>
        </div>
      )}
    </div>
  );
}
