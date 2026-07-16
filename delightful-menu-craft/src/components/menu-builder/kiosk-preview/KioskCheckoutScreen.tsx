import { useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { effectiveUnitPrice } from '@/lib/posPricing';
import { effectiveItemTaxRate } from '@/lib/tax';
import type { CartLine } from './KioskPreview';

interface KioskCheckoutScreenProps {
  lines: CartLine[];
  subtotal: number;
  onBack: () => void;
  onPlaceOrder: () => void;
}

/**
 * Kiosk checkout: Subtotal / Tax / Total summary + estimated prep time + Pay.
 * Tax mirrors the POS preview exactly (per-item rate × line base, standard rate
 * from store settings). Tip is intentionally omitted (no menu-data backing).
 */
export function KioskCheckoutScreen({ lines, subtotal, onBack, onPlaceOrder }: KioskCheckoutScreenProps) {
  const { modifiers, modifierModifierOptions, customTaxes, taxRate } = useMenuStore();

  const tax = useMemo(() => {
    const raw = lines.reduce((s, l) => {
      const unit = effectiveUnitPrice(l.item.itemPrice, l.selectedOptions, modifiers, modifierModifierOptions);
      const base = unit * l.qty;
      const rate = effectiveItemTaxRate(l.item, customTaxes, taxRate);
      return s + base * (rate / 100);
    }, 0);
    return Math.round(raw * 100) / 100;
  }, [lines, modifiers, modifierModifierOptions, customTaxes, taxRate]);

  const total = Math.round((subtotal + tax) * 100) / 100;

  // Items cook in parallel, so the order's prep time is the slowest item's.
  const prepTime = useMemo(
    () => lines.reduce((max, l) => Math.max(max, l.item.preparationTime || 0), 0),
    [lines],
  );

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header */}
      <div className="relative flex shrink-0 items-center justify-center border-b border-black/5 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-3 flex h-9 w-9 items-center justify-center rounded-full text-[#ED7C69] hover:bg-[#F1F1F1]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold text-[#242528]">Checkout</h2>
      </div>

      {/* Summary */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="space-y-2.5">
            <SummaryRow label="Subtotal" value={subtotal} />
            <SummaryRow label="Tax" value={tax} />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3">
            <span className="text-lg font-bold text-[#242528]">Total</span>
            <span className="text-lg font-bold tabular-nums text-[#ED7C69]">${total.toFixed(2)}</span>
          </div>
        </div>

        {prepTime > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-black/5">
            <span className="text-base font-semibold text-[#242528]">Estimated prep time</span>
            <span className="text-base font-semibold tabular-nums text-[#242528]">{prepTime} mins</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-3 border-t border-black/5 bg-white px-4 py-4">
        <button
          type="button"
          className="rounded-2xl border border-[#ED7C69] px-5 py-3 text-sm font-semibold text-[#ED7C69] transition-colors hover:bg-[#ED7C69]/5"
        >
          Need help
        </button>
        <button
          type="button"
          onClick={onPlaceOrder}
          className="flex-1 rounded-2xl bg-[#ED7C69] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#E06A55]"
        >
          Pay ${total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#6B6B6B]">{label}</span>
      <span className="text-sm font-medium tabular-nums text-[#242528]">${value.toFixed(2)}</span>
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
