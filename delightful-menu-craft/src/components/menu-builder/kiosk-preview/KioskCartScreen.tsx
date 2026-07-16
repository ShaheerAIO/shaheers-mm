import { useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { ChevronLeft, Minus, Plus, UtensilsCrossed } from 'lucide-react';
import type { Item } from '@/types/menu';
import { effectiveUnitPrice } from '@/lib/posPricing';
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

/** Kiosk "Review your order": line list with edit/qty/remove + Subtotal. */
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

  /** Dot-joined option names for a line ("Medium · Warm it up"). */
  const optionSummary = (line: CartLine): string =>
    Object.values(line.selectedOptions)
      .flat()
      .map((optionId) => {
        const option = modifierOptions.find((o) => o.id === optionId);
        return option ? option.posDisplayName || option.optionName : null;
      })
      .filter((n): n is string => !!n)
      .join(' · ');

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F1F1F1]"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-[#242528]">Review your order</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-[#ED7C69] hover:opacity-80"
        >
          + Add more
        </button>
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
              const unit = effectiveUnitPrice(
                line.item.itemPrice,
                line.selectedOptions,
                modifiers,
                modifierModifierOptions,
              );
              const lineTotal = unit * line.qty;
              const summary = optionSummary(line);
              return (
                <div key={line.lineId} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                  <EditThumb item={line.item} onEdit={() => onEditLine(line.lineId)} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[#242528]">
                        {line.item.posDisplayName || line.item.itemName}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[#242528]">
                        ${lineTotal.toFixed(2)}
                      </span>
                    </div>
                    {summary && <p className="truncate text-xs text-[#9A9A9A]">{summary}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => onRemove(line.lineId)}
                        className="text-sm font-medium text-[#ED7C69] hover:opacity-80"
                      >
                        Remove
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => (line.qty <= 1 ? onRemove(line.lineId) : onChangeQty(line.lineId, line.qty - 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ED7C69] text-white"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold tabular-nums text-[#242528]">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeQty(line.lineId, line.qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ED7C69] text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subtotal + footer */}
      <div className="shrink-0 space-y-3 border-t border-black/5 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-[#242528]">Subtotal</span>
          <span className="text-xl font-bold tabular-nums text-[#242528]">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClear}
            disabled={lines.length === 0}
            className="rounded-2xl border border-[#ED7C69] px-5 py-3 text-sm font-semibold text-[#ED7C69] transition-colors hover:bg-[#ED7C69]/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel order
          </button>
          <button
            type="button"
            onClick={onCheckout}
            disabled={lines.length === 0}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-2xl px-5 py-3 text-base font-semibold text-white transition-colors',
              lines.length === 0 ? 'cursor-not-allowed bg-[#D9D9D9]' : 'bg-[#ED7C69] hover:bg-[#E06A55]',
            )}
          >
            <span>Checkout</span>
            <span className="tabular-nums">(${subtotal.toFixed(2)})</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Line thumbnail with an "Edit" label overlay; tapping it re-opens customize. */
function EditThumb({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const [imgError, setImgError] = useState(false);
  const showImage = item.kioskItemImage && !imgError;
  return (
    <button
      type="button"
      onClick={onEdit}
      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F1F1F1]"
      aria-label="Edit item"
    >
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
      <span className="absolute inset-x-0 bottom-0 bg-white/85 py-0.5 text-center text-[10px] font-semibold text-[#ED7C69]">
        Edit
      </span>
    </button>
  );
}
