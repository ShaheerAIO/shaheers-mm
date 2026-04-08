import { useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { X, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function CreateOptionPanel() {
  const { setIsCreatingOption, setPendingOption } = useMenuStore();

  const [optionName, setOptionName] = useState('');
  const [posDisplayName, setPosDisplayName] = useState('');
  const [posDisplayNameTouched, setPosDisplayNameTouched] = useState(false);
  const [isStockAvailable, setIsStockAvailable] = useState(true);
  const [isSizeModifier, setIsSizeModifier] = useState(false);

  const handleSave = () => {
    if (!optionName.trim()) return;

    setPendingOption({
      optionName: optionName.trim(),
      posDisplayName: posDisplayName.trim() || optionName.trim(),
      isStockAvailable,
      isSizeModifier,
    });

    // Close the panel (CreateModifierPanel will pick up the pending option)
    setIsCreatingOption(false);

    // Reset form
    setOptionName('');
    setPosDisplayName('');
    setPosDisplayNameTouched(false);
    setIsStockAvailable(true);
    setIsSizeModifier(false);
  };

  const handleCancel = () => {
    setIsCreatingOption(false);
    // Reset form
    setOptionName('');
    setPosDisplayName('');
    setPosDisplayNameTouched(false);
    setIsStockAvailable(true);
    setIsSizeModifier(false);
  };

  const isValid = optionName.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 sm:px-4 border-b border-panel-border flex-shrink-0">
        <h3 className="font-semibold text-sm sm:text-base">Create Option</h3>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 space-y-4 scrollbar-thin">
        {/* Option Name */}
        <div className="space-y-2">
          <Label htmlFor="optionName" className="section-header">
            Option Name *
          </Label>
          <input
            id="optionName"
            type="text"
            value={optionName}
            onChange={(e) => {
              setOptionName(e.target.value);
              if (!posDisplayNameTouched) {
                setPosDisplayName(e.target.value);
              }
            }}
            placeholder="e.g., Extra Cheese, No Onions"
            className="input-field w-full"
            autoFocus
          />
        </div>

        {/* POS Display Name */}
        <div className="space-y-2">
          <Label htmlFor="posDisplayName" className="section-header">
            POS Display Name
          </Label>
          <input
            id="posDisplayName"
            type="text"
            value={posDisplayName}
            onChange={(e) => {
              setPosDisplayName(e.target.value);
              setPosDisplayNameTouched(true);
            }}
            placeholder="Leave blank to use option name"
            className="input-field w-full"
          />
          <p className="text-xs text-muted-foreground">
            How it appears on the POS screen
          </p>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="inStock" className="text-sm">In Stock</Label>
              <p className="text-xs text-muted-foreground">Option is available for selection</p>
            </div>
            <Switch
              id="inStock"
              checked={isStockAvailable}
              onCheckedChange={setIsStockAvailable}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sizeModifier" className="text-sm">Size Modifier</Label>
              <p className="text-xs text-muted-foreground">This option changes the item size</p>
            </div>
            <Switch
              id="sizeModifier"
              checked={isSizeModifier}
              onCheckedChange={setIsSizeModifier}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 sm:p-4 border-t border-border bg-panel-bg flex gap-2 flex-shrink-0">
        <button
          onClick={handleCancel}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add to Modifier
        </button>
      </div>
    </div>
  );
}
