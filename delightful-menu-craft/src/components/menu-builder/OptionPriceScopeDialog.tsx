import type { ReactNode } from 'react';
import { Globe, SplitSquareHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface OptionPriceScopeDialogProps {
  open: boolean;
  optionName: string;
  currentPrice: number;
  nextPrice: number;
  /** What else references this option row, e.g. "2 other modifiers use this option". */
  sharedSummary: string;
  /** Consequence of moving every use of the option to the new price. */
  everywhereDescription: ReactNode;
  /** Label for the narrower choice, e.g. `Only for “Margherita Pizza”`. */
  scopedLabel: string;
  scopedDescription: ReactNode;
  /** Set when the narrow choice can't be honoured; `scopedDescription` should say why. */
  scopedDisabled?: boolean;
  onEverywhere: () => void;
  onScoped: () => void;
  onCancel: () => void;
}

/**
 * The POS keeps one price per modifier option, so a shared option can't hold two
 * prices. When an edit would spill onto other modifiers or items, make the
 * operator choose: move every use to the new price, or fork the shared rows into a
 * separately priced copy (the same thing operators do by hand today).
 */
export function OptionPriceScopeDialog({
  open,
  optionName,
  currentPrice,
  nextPrice,
  sharedSummary,
  everywhereDescription,
  scopedLabel,
  scopedDescription,
  scopedDisabled,
  onEverywhere,
  onScoped,
  onCancel,
}: OptionPriceScopeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            “{optionName}” — ${currentPrice.toFixed(2)} → ${nextPrice.toFixed(2)}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            A modifier option carries a single price in the POS, and {sharedSummary}. Pick
            where this price should apply.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onEverywhere}
            className="w-full text-left rounded-md border border-border hover:border-primary/60 hover:bg-muted/40 transition-colors px-3 py-2.5 flex gap-3"
          >
            <Globe className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">Change everywhere</span>
              <span className="block text-xs text-muted-foreground leading-relaxed">
                {everywhereDescription}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onScoped}
            disabled={scopedDisabled}
            className={cn(
              'w-full text-left rounded-md border border-border transition-colors px-3 py-2.5 flex gap-3',
              scopedDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-primary/60 hover:bg-muted/40',
            )}
          >
            <SplitSquareHorizontal className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{scopedLabel}</span>
              <span className="block text-xs text-muted-foreground leading-relaxed">
                {scopedDescription}
              </span>
            </span>
          </button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
