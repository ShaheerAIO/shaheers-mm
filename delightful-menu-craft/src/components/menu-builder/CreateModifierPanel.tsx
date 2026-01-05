import { useState, useMemo, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { X, Plus, Trash2, Save, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Modifier, ModifierOption } from '@/types/menu';

interface CreateModifierPanelProps {
  itemId: number;
}

type OptionDraft = {
  id: string; // temporary ID for React key
  type: 'existing' | 'new';
  optionName: string;
  posDisplayName: string;
  price: number;
  isDefaultSelected: boolean;
} & (
  | { type: 'existing'; existingOptionId: number }
  | { type: 'new'; isStockAvailable: boolean; isSizeModifier: boolean }
);

export function CreateModifierPanel({ itemId }: CreateModifierPanelProps) {
  const {
    setIsCreatingModifier,
    setIsCreatingOption,
    pendingOption,
    setPendingOption,
    modifierOptions,
    itemModifiers,
    addModifier,
    addModifierOption,
    addModifierModifierOption,
    addItemModifier,
    getNextId,
  } = useMenuStore();

  // Modifier fields
  const [modifierName, setModifierName] = useState('');
  const [posDisplayName, setPosDisplayName] = useState('');
  const [minSelector, setMinSelector] = useState(0);
  const [maxSelector, setMaxSelector] = useState(1);
  const [noMaxSelection, setNoMaxSelection] = useState(false);
  const [isOptional, setIsOptional] = useState('Select any');
  const [onPrem, setOnPrem] = useState(true);
  const [offPrem, setOffPrem] = useState(true);

  // Options being added to this modifier
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  // Watch for pending option from CreateOptionPanel
  useEffect(() => {
    if (pendingOption) {
      const option: OptionDraft = {
        id: `new-${Date.now()}`,
        type: 'new',
        optionName: pendingOption.optionName,
        posDisplayName: pendingOption.posDisplayName,
        price: 0,
        isDefaultSelected: false,
        isStockAvailable: pendingOption.isStockAvailable,
        isSizeModifier: pendingOption.isSizeModifier,
      };

      setOptions(prev => [...prev, option]);
      setPendingOption(null); // Clear the pending option
    }
  }, [pendingOption, setPendingOption]);

  // Get available options (not yet added to this modifier)
  const availableOptions = useMemo(() => {
    const addedOptionIds = options
      .filter(opt => opt.type === 'existing')
      .map(opt => (opt as Extract<OptionDraft, { type: 'existing' }>).existingOptionId);

    return modifierOptions.filter(o => !addedOptionIds.includes(o.id));
  }, [modifierOptions, options]);

  // Get existing item modifiers count for sort order
  const itemModifiersCount = useMemo(() => {
    return itemModifiers.filter(im => im.itemId === itemId).length;
  }, [itemModifiers, itemId]);

  const handleAddExistingOption = (optionId: string) => {
    const id = parseInt(optionId);
    if (isNaN(id)) return;

    const option = modifierOptions.find(o => o.id === id);
    if (!option) return;

    const newOption: OptionDraft = {
      id: `existing-${id}-${Date.now()}`,
      type: 'existing',
      existingOptionId: id,
      optionName: option.optionName,
      posDisplayName: option.posDisplayName,
      price: 0,
      isDefaultSelected: false,
    };

    setOptions([...options, newOption]);
  };

  const handleCreateNewOption = () => {
    setIsCreatingOption(true);
  };

  const handleOptionCreated = (newOption: {
    optionName: string;
    posDisplayName: string;
    isStockAvailable: boolean;
    isSizeModifier: boolean;
  }) => {
    const option: OptionDraft = {
      id: `new-${Date.now()}`,
      type: 'new',
      optionName: newOption.optionName,
      posDisplayName: newOption.posDisplayName,
      price: 0,
      isDefaultSelected: false,
      isStockAvailable: newOption.isStockAvailable,
      isSizeModifier: newOption.isSizeModifier,
    };

    setOptions([...options, option]);
    setIsCreatingOption(false);
  };

  const handleRemoveOption = (optionId: string) => {
    setOptions(options.filter(opt => opt.id !== optionId));
  };

  const handleOptionPriceChange = (optionId: string, price: number) => {
    setOptions(
      options.map(opt =>
        opt.id === optionId ? { ...opt, price } : opt
      )
    );
  };

  const handleOptionDefaultChange = (optionId: string, isDefault: boolean) => {
    setOptions(
      options.map(opt =>
        opt.id === optionId ? { ...opt, isDefaultSelected: isDefault } : opt
      )
    );
  };

  const handleSave = () => {
    // Validation
    if (!modifierName.trim()) {
      alert('Modifier name is required');
      return;
    }
    if (options.length === 0) {
      alert('At least one option is required');
      return;
    }

    // 1. Create the new modifier
    const newModifierId = getNextId('modifiers');
    const newModifier: Modifier = {
      id: newModifierId,
      modifierName: modifierName.trim(),
      posDisplayName: posDisplayName.trim() || modifierName.trim(),
      minSelector,
      maxSelector,
      noMaxSelection,
      isOptional,
      onPrem,
      offPrem,
      // Default values for other required fields
      isNested: false,
      addNested: false,
      modifierOptionPriceType: 'NoCharge',
      canGuestSelectMoreModifiers: true,
      multiSelect: false,
      limitIndividualModifierSelection: false,
      prefix: '',
      pizzaSelection: false,
      price: 0,
      parentModifierId: 0,
      modifierIds: '',
      isSizeModifier: false,
    };
    addModifier(newModifier);

    // 2. Create new options and link all options to modifier
    options.forEach((opt, index) => {
      let optionId: number;

      if (opt.type === 'existing') {
        optionId = opt.existingOptionId;
      } else {
        // Create new option
        optionId = getNextId('modifierOptions');
        const newOption: ModifierOption = {
          id: optionId,
          optionName: opt.optionName,
          posDisplayName: opt.posDisplayName,
          parentModifierId: newModifierId,
          isStockAvailable: opt.isStockAvailable,
          isSizeModifier: opt.isSizeModifier,
        };
        addModifierOption(newOption);
      }

      // Link option to modifier
      addModifierModifierOption({
        modifierId: newModifierId,
        modifierOptionId: optionId,
        isDefaultSelected: opt.isDefaultSelected,
        maxLimit: opt.price,
        optionDisplayName: opt.optionName,
        sortOrder: index,
      });
    });

    // 3. Add modifier to the item
    addItemModifier({
      modifierId: newModifierId,
      itemId: itemId,
      sortOrder: itemModifiersCount,
    });

    // 4. Show save notification
    setShowSaveNotification(true);
    setTimeout(() => {
      setShowSaveNotification(false);
      // Close and reset after notification
      setIsCreatingModifier(false);
      resetForm();
    }, 2000);
  };

  const handleCancel = () => {
    setIsCreatingModifier(false);
    resetForm();
  };

  const resetForm = () => {
    setModifierName('');
    setPosDisplayName('');
    setMinSelector(0);
    setMaxSelector(1);
    setNoMaxSelection(false);
    setIsOptional('Select any');
    setOnPrem(true);
    setOffPrem(true);
    setOptions([]);
  };

  const isValid = modifierName.trim().length > 0 && options.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-panel-border flex-shrink-0">
        <h3 className="font-semibold">Create Modifier</h3>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
        {/* Modifier Name */}
        <div className="space-y-2">
          <Label className="section-header">Modifier Name *</Label>
          <input
            type="text"
            value={modifierName}
            onChange={(e) => {
              setModifierName(e.target.value);
              if (!posDisplayName) {
                setPosDisplayName(e.target.value);
              }
            }}
            className="input-field text-lg font-semibold w-full"
            placeholder="e.g., Toppings, Size, Add-ons"
            autoFocus
          />
        </div>

        {/* Channel Availability */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <Label className="section-header">Channel Availability</Label>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="onPrem" className="text-sm">On-Premise (Dine-in)</Label>
              <p className="text-xs text-muted-foreground">Show for in-house orders</p>
            </div>
            <Switch
              id="onPrem"
              checked={onPrem}
              onCheckedChange={setOnPrem}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="offPrem" className="text-sm">Off-Premise (Delivery/Pickup)</Label>
              <p className="text-xs text-muted-foreground">Show for online/delivery orders</p>
            </div>
            <Switch
              id="offPrem"
              checked={offPrem}
              onCheckedChange={setOffPrem}
            />
          </div>
        </div>

        {/* Selection Rules */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="section-header text-xs">Min Selection</Label>
            <input
              type="number"
              min={0}
              value={minSelector}
              onChange={(e) => setMinSelector(parseInt(e.target.value) || 0)}
              className="input-field w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="section-header text-xs">Max Selection</Label>
            <input
              type="number"
              min={1}
              value={maxSelector}
              onChange={(e) => setMaxSelector(parseInt(e.target.value) || 1)}
              disabled={noMaxSelection}
              className="input-field w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="section-header text-xs">No Max</Label>
            <div className="pt-2">
              <Switch
                checked={noMaxSelection}
                onCheckedChange={setNoMaxSelection}
              />
            </div>
          </div>
        </div>

        {/* Selection Type */}
        <div className="space-y-2">
          <Label className="section-header">Selection Type</Label>
          <Select value={isOptional} onValueChange={setIsOptional}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Select any">Optional (Select any)</SelectItem>
              <SelectItem value="Required">Required</SelectItem>
              <SelectItem value="Select one">Select One</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="section-header">
              Options ({options.length}) *
            </Label>
            <div className="flex gap-2">
              {availableOptions.length > 0 && (
                <Select onValueChange={handleAddExistingOption}>
                  <SelectTrigger className="w-28">
                    <span className="text-xs">Add Existing</span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id.toString()}>
                        {option.optionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <button className="btn-add" onClick={handleCreateNewOption}>
                <Plus className="w-3.5 h-3.5" />
                New Option
              </button>
            </div>
          </div>

          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
              No options added yet. Add at least one option to continue.
            </p>
          ) : (
            <div className="space-y-2">
              {options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {option.optionName}
                      </span>
                      {option.type === 'new' && (
                        <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
                          New
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={option.price}
                        onChange={(e) =>
                          handleOptionPriceChange(option.id, parseFloat(e.target.value) || 0)
                        }
                        className="input-field w-20 text-sm"
                        placeholder="0.00"
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                        <input
                          type="checkbox"
                          checked={option.isDefaultSelected}
                          onChange={(e) =>
                            handleOptionDefaultChange(option.id, e.target.checked)
                          }
                          className="rounded"
                        />
                        Default
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveOption(option.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-panel-bg flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            isValid
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Save className="w-4 h-4" />
          Save & Add to Item
        </button>
      </div>

      {/* Save Confirmation Notification */}
      {showSaveNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-slide-up">
            <Check className="w-5 h-5" />
            <span className="font-medium">Modifier saved and added to item</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Export the handler for CreateOptionPanel
export { CreateModifierPanel as default };
