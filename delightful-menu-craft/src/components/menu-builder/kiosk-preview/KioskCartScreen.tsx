import { useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { ChevronLeft, Minus, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import type { Item } from '@/types/menu';
import { modifierSurchargePerUnit } from '@/lib/posPricing';
import type { CartLine } from './KioskPreview';

interface KioskCartScreenProps {
  lines: CartLine[];
  subtotal: number;
  onBack: () => void;
  onRemove: (lineId: string) => void;
  onChangeQty: (lineId: string, qty: number) => void;
  onEditLine: (lineId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
}

/** Kiosk cart screen: line list with qty steppers + Subtotal (no tax/total). */
export function KioskCartScreen({
  lines,
  subtotal,
  onBack,
  onRemove,
  onChangeQty,
  onEditLine,
  onClear,
  onCheckout,
}: KioskCartScreenProps) {
  const { modifiers, modifierOptions, modifierModifierOptions } = useMenuStore();

  /** Build "Group: Option" labels for a line's selected options. */
  const optionLabels = (line: CartLine): string[] => {
    const labels: string[] = [];
    for (const [modifierIdStr, optionIds] of Object.entries(line.selectedOptions)) {
      const modifierId = parseInt(modifierIdStr, 10);
      const modifier = modifiers.find((m) => m.id === modifierId);
      for (const optionId of optionIds) {
        const option = modifierOptions.find((o) => o.id === optionId);
        if (!option) continue;
        const name = option.posDisplayName || option.optionName;
        labels.push(modifier ? `${modifier.posDisplayName || modifier.modifierName}: ${name}` : name);
      }
    }
    return labels;
  };

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F1F1F1]"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-[#242528]">Your Cart</h2>
        </div>
        {lines.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-[#9A9A9A] hover:text-[#ED7C69]"
          >
            Empty Cart
          </button>
        )}
      </div>

      {/* Lines */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {lines.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[#9A9A9A]">
            Your cart is empty
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => {
              const perUnit = modifierSurchargePerUnit(line.selectedOptions, modifierModifierOptions);
              const lineTotal = (line.item.itemPrice + perUnit) * line.qty;
              return (
                <div key={line.lineId} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                  <CartThumb item={line.item} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onEditLine(line.lineId)}
                        className="truncate text-left text-sm font-semibold text-[#242528] hover:text-[#ED7C69]"
                      >
                        {line.item.posDisplayName || line.item.itemName}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(line.lineId)}
                        className="shrink-0 text-[#C9C9C9] hover:text-[#ED7C69]"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {optionLabels(line).map((label, i) => (
                      <p key={i} className="truncate text-xs text-[#9A9A9A]">
                        {label}
                      </p>
                    ))}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => (line.qty <= 1 ? onRemove(line.lineId) : onChangeQty(line.lineId, line.qty - 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B]"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold tabular-nums text-[#242528]">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeQty(line.lineId, line.qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-[#242528]">
                        ${lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subtotal + Checkout */}
      <div className="shrink-0 space-y-3 border-t border-black/5 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-[#242528]">Subtotal</span>
          <span className="text-xl font-bold tabular-nums text-[#ED7C69]">${subtotal.toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={lines.length === 0}
          className={cn(
            'w-full rounded-2xl px-5 py-3.5 text-base font-semibold text-white transition-colors',
            lines.length === 0 ? 'cursor-not-allowed bg-[#D9D9D9]' : 'bg-[#ED7C69] hover:bg-[#E06A55]',
          )}
        >
          Checkout
        </button>
      </div>
    </div>
  );
}

export function CartThumb({ item }: { item: Item }) {
  const [imgError, setImgError] = useState(false);
  const showImage = item.kioskItemImage && !imgError;
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F1F1F1]">
      {showImage ? (
        <img
          src={item.kioskItemImage}
          alt={item.itemName}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#C9C9C9]">
          <UtensilsCrossed className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}
