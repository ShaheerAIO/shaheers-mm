import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Upload } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Item } from '@/types/menu';
import { modifierSurchargePerUnit } from '@/lib/posPricing';
import { KioskMenuScreen } from './KioskMenuScreen';
import { KioskCustomizeScreen } from './KioskCustomizeScreen';
import { KioskCartScreen } from './KioskCartScreen';
import { KioskCheckoutScreen, KioskConfirmationScreen } from './KioskCheckoutScreen';

export interface CartLine {
  /** Unique key per line so the same item can appear multiple times. */
  lineId: string;
  item: Item;
  qty: number;
  /** modifierId -> selected optionIds (duplicates encode multi-quantity). */
  selectedOptions: Record<number, number[]>;
}

type Screen = 'menu' | 'customize' | 'cart' | 'checkout' | 'confirmation';

/**
 * Kiosk preview: renders the menu the way the Android kiosk displays it so menu
 * engineers can verify items/categories/prices/subtotals after editing. Mirrors
 * POSPreview's local-state model; reuses the shared surcharge math.
 */
export function KioskPreview() {
  const { menus, selectedMenuId, setSelectedMenu, isDataLoaded, modifierModifierOptions } = useMenuStore();

  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [screen, setScreen] = useState<Screen>('menu');
  const [customizeItem, setCustomizeItem] = useState<Item | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  /** Bumps so a fresh customize remounts with default selections. */
  const [newInstance, setNewInstance] = useState(0);

  const addToCart = (item: Item, selectedOptions: Record<number, number[]> = {}, qty = 1) => {
    setCartLines((prev) => [
      ...prev,
      { lineId: `${item.id}-${Date.now()}-${Math.random()}`, item, qty, selectedOptions },
    ]);
  };
  const removeFromCart = (lineId: string) => setCartLines((prev) => prev.filter((l) => l.lineId !== lineId));
  const changeQty = (lineId: string, qty: number) =>
    setCartLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, qty } : l)));
  const clearCart = () => setCartLines([]);

  const subtotal = useMemo(
    () =>
      cartLines.reduce((s, l) => {
        const mod = modifierSurchargePerUnit(l.selectedOptions, modifierModifierOptions);
        return s + (l.item.itemPrice + mod) * l.qty;
      }, 0),
    [cartLines, modifierModifierOptions],
  );
  const cartCount = useMemo(() => cartLines.reduce((n, l) => n + l.qty, 0), [cartLines]);

  const handleSelectItem = (item: Item) => {
    // Mirror the real kiosk: every item tap opens its detail/customize screen,
    // and the user adds to cart from there — even items with no modifiers.
    setEditingLineId(null);
    setNewInstance((n) => n + 1);
    setCustomizeItem(item);
    setScreen('customize');
  };

  const handleEditLine = (lineId: string) => {
    const line = cartLines.find((l) => l.lineId === lineId);
    if (!line) return;
    setEditingLineId(lineId);
    setCustomizeItem(line.item);
    setScreen('customize');
  };

  const editingLine = editingLineId ? cartLines.find((l) => l.lineId === editingLineId) : undefined;

  // ── Guard states ──
  if (!isDataLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-black/5 bg-[#FAFAFA]">
        <div className="text-center text-[#9A9A9A]">
          <Upload className="mx-auto mb-4 h-12 w-12 opacity-60" />
          <h3 className="mb-2 text-lg font-medium text-[#6B6B6B]">No Data Loaded</h3>
          <p className="text-sm">Import an Excel file or use the DoorDash extension to preview</p>
        </div>
      </div>
    );
  }
  if (!selectedMenuId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-black/5 bg-[#FAFAFA] text-[#9A9A9A]">
        <p>Select a menu to preview</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      {/* Preview chrome: menu selector (not part of the kiosk screen) */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <Select
          value={selectedMenuId?.toString() ?? ''}
          onValueChange={(v) => setSelectedMenu(v ? parseInt(v, 10) : null)}
        >
          <SelectTrigger className="h-9 w-[min(220px,50vw)] border-zinc-700 bg-zinc-900 text-sm text-zinc-100">
            <SelectValue placeholder="Menu" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
            {menus.map((m) => (
              <SelectItem key={m.id} value={m.id.toString()} className="text-zinc-100">
                {m.menuName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Vertical kiosk device frame — portrait 9:16; surrounding space is intentionally unused */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        <div className="flex aspect-[9/16] h-full max-w-full flex-col overflow-hidden rounded-3xl border border-black/10 bg-[#FAFAFA] shadow-xl">
        {screen === 'customize' && customizeItem ? (
          <KioskCustomizeScreen
            key={editingLineId ?? `new-${newInstance}`}
            item={customizeItem}
            initialSelectedOptions={editingLine?.selectedOptions}
            initialQty={editingLine?.qty}
            onAddToCart={(item, opts, qty) => {
              if (editingLineId) {
                setCartLines((prev) =>
                  prev.map((l) => (l.lineId === editingLineId ? { ...l, selectedOptions: opts, qty } : l)),
                );
                setScreen('cart');
              } else {
                addToCart(item, opts, qty);
                setScreen('menu');
              }
              setEditingLineId(null);
              setCustomizeItem(null);
            }}
            onBack={() => {
              setScreen(editingLineId ? 'cart' : 'menu');
              setEditingLineId(null);
              setCustomizeItem(null);
            }}
          />
        ) : screen === 'cart' ? (
          <KioskCartScreen
            lines={cartLines}
            subtotal={subtotal}
            onBack={() => setScreen('menu')}
            onRemove={removeFromCart}
            onChangeQty={changeQty}
            onEditLine={handleEditLine}
            onClear={clearCart}
            onCheckout={() => setScreen('checkout')}
          />
        ) : screen === 'checkout' ? (
          <KioskCheckoutScreen
            lines={cartLines}
            subtotal={subtotal}
            onBack={() => setScreen('cart')}
            onAddMore={() => setScreen('menu')}
            onPlaceOrder={() => setScreen('confirmation')}
          />
        ) : screen === 'confirmation' ? (
          <KioskConfirmationScreen
            onNewOrder={() => {
              clearCart();
              setScreen('menu');
            }}
          />
        ) : (
          <KioskMenuScreen
            onSelectItem={handleSelectItem}
            cartCount={cartCount}
            subtotal={subtotal}
            onViewCart={() => setScreen('cart')}
          />
        )}
        </div>
      </div>
    </div>
  );
}
