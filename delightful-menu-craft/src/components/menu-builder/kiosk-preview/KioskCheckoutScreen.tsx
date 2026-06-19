import { useMenuStore } from '@/store/menuStore';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { modifierSurchargePerUnit } from '@/lib/posPricing';
import type { CartLine } from './KioskPreview';
import { CartThumb } from './KioskCartScreen';

interface KioskCheckoutScreenProps {
  lines: CartLine[];
  subtotal: number;
  onBack: () => void;
  onAddMore: () => void;
  onPlaceOrder: () => void;
}

/** Kiosk checkout: read-only "Review Your Order" recap + Place Order. */
export function KioskCheckoutScreen({
  lines,
  subtotal,
  onBack,
  onAddMore,
  onPlaceOrder,
}: KioskCheckoutScreenProps) {
  const { modifiers, modifierOptions, modifierModifierOptions } = useMenuStore();

  const optionLabels = (line: CartLine): string[] => {
    const labels: string[] = [];
    for (const [modifierIdStr, optionIds] of Object.entries(line.selectedOptions)) {
      const modifier = modifiers.find((m) => m.id === parseInt(modifierIdStr, 10));
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
          <h2 className="text-base font-semibold text-[#242528]">Review Your Order</h2>
        </div>
        <button
          type="button"
          onClick={onAddMore}
          className="text-sm font-medium text-[#9A9A9A] hover:text-[#ED7C69]"
        >
          Add More
        </button>
      </div>

      {/* Read-only recap */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {lines.map((line) => {
            const perUnit = modifierSurchargePerUnit(line.selectedOptions, modifierModifierOptions);
            const lineTotal = (line.item.itemPrice + perUnit) * line.qty;
            return (
              <div key={line.lineId} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                <CartThumb item={line.item} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[#242528]">
                      {line.item.posDisplayName || line.item.itemName}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[#242528]">
                      ${lineTotal.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-xs text-[#9A9A9A]">Qty {line.qty}</span>
                  {optionLabels(line).map((label, i) => (
                    <p key={i} className="truncate text-xs text-[#9A9A9A]">
                      {label}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subtotal + Place Order */}
      <div className="shrink-0 space-y-3 border-t border-black/5 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-[#242528]">Subtotal</span>
          <span className="text-xl font-bold tabular-nums text-[#ED7C69]">${subtotal.toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={onPlaceOrder}
          className="w-full rounded-2xl bg-[#ED7C69] px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#E06A55]"
        >
          Place Order
        </button>
      </div>
    </div>
  );
}

/** Order-placed confirmation (terminal screen in the real kiosk flow). */
export function KioskConfirmationScreen({ onNewOrder }: { onNewOrder: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#FAFAFA] px-8 text-center">
      <CheckCircle2 className="h-16 w-16 text-[#ED7C69]" />
      <div>
        <h2 className="text-xl font-bold text-[#242528]">Order Placed!</h2>
        <p className="mt-1 text-sm text-[#9A9A9A]">Thanks — your order has been sent to the kitchen.</p>
      </div>
      <button
        type="button"
        onClick={onNewOrder}
        className="rounded-2xl bg-[#ED7C69] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#E06A55]"
      >
        Start New Order
      </button>
    </div>
  );
}
