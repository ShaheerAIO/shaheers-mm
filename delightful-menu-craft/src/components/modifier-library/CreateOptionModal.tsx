import { useState } from 'react';
import { X, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface CreateOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (option: {
    optionName: string;
    posDisplayName: string;
    price: number;
    isStockAvailable: boolean;
    isSizeModifier: boolean;
  }) => void;
}

export function CreateOptionModal({ isOpen, onClose, onSave }: CreateOptionModalProps) {
  const [optionName, setOptionName] = useState('');
  const [posDisplayName, setPosDisplayName] = useState('');
  const [posDisplayNameTouched, setPosDisplayNameTouched] = useState(false);
  const [price, setPrice] = useState('0.00');
  const [isStockAvailable, setIsStockAvailable] = useState(true);
  const [isSizeModifier, setIsSizeModifier] = useState(false);

  const handleSave = () => {
    if (!optionName.trim()) return;
    
    onSave({
      optionName: optionName.trim(),
      posDisplayName: posDisplayName.trim() || optionName.trim(),
      price: parseFloat(price) || 0,
      isStockAvailable,
      isSizeModifier,
    });

    // Reset form
    setOptionName('');
    setPosDisplayName('');
    setPosDisplayNameTouched(false);
    setPrice('0.00');
    setIsStockAvailable(true);
    setIsSizeModifier(false);
    onClose();
  };

  const handleClose = () => {
    setOptionName('');
    setPosDisplayName('');
    setPosDisplayNameTouched(false);
    setPrice('0.00');
    setIsStockAvailable(true);
    setIsSizeModifier(false);
    onClose();
  };

  const isValid = optionName.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Option</DialogTitle>
          <DialogDescription>
            Create a new modifier option that can be assigned to any modifier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Option Name */}
          <div className="space-y-2">
            <Label htmlFor="optionName">Option Name *</Label>
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
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>

          {/* POS Display Name */}
          <div className="space-y-2">
            <Label htmlFor="posDisplayName">POS Display Name</Label>
            <input
              id="posDisplayName"
              type="text"
              value={posDisplayName}
              onChange={(e) => {
                setPosDisplayName(e.target.value);
                setPosDisplayNameTouched(true);
              }}
              placeholder="Leave blank to use option name"
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              How it appears on the POS screen
            </p>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Additional Price</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <input
                id="price"
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-24 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Extra charge when this option is selected
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="inStock">In Stock</Label>
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
                <Label htmlFor="sizeModifier">Size Modifier</Label>
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
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 transition-colors",
              isValid
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Save className="w-4 h-4" />
            Create Option
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

