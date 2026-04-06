import { useMemo, useState, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import {
  Upload,
  Menu,
  ChevronRight,
  Lock,
  Clock,
  User,
  Search,
  Filter,
  UtensilsCrossed,
  ShoppingBag,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Item } from '@/types/menu';
import { QSRMenuPanel } from './pos-preview/QSRMenuPanel';
import { TSRMenuPanel } from './pos-preview/TSRMenuPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TicketLine {
  /** Unique key per line so the same item can appear multiple times */
  lineId: string;
  item: Item;
  qty: number;
  /** modifierId -> selected optionIds */
  selectedOptions: Record<number, number[]>;
}

type PosMode = 'qsr' | 'tsr';

const TAX_RATE = 0.05;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function POSPreview() {
  const { menus, selectedMenuId, setSelectedMenu, isDataLoaded } = useMenuStore();

  // Clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // POS mode toggle
  const [posMode, setPosMode] = useState<PosMode>('tsr');

  // Local ticket state
  const [ticketLines, setTicketLines] = useState<TicketLine[]>([]);

  const addToTicket = (
    item: Item,
    selectedOptions: Record<number, number[]> = {},
    qty = 1,
  ) => {
    setTicketLines((prev) => [
      ...prev,
      {
        lineId: `${item.id}-${Date.now()}-${Math.random()}`,
        item,
        qty,
        selectedOptions,
      },
    ]);
  };

  const removeFromTicket = (lineId: string) => {
    setTicketLines((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const clearTicket = () => setTicketLines([]);

  // Financials
  const subtotal = useMemo(
    () => ticketLines.reduce((s, l) => s + l.item.itemPrice * l.qty, 0),
    [ticketLines],
  );
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  // ---------------------------------------------------------------------------
  // Guard states
  // ---------------------------------------------------------------------------

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-full rounded-lg bg-[hsl(var(--pos-shell))] border border-[hsl(var(--pos-shell-border))]">
        <div className="text-center text-zinc-400">
          <Upload className="w-12 h-12 mx-auto mb-4 opacity-60" />
          <h3 className="text-lg font-medium text-zinc-200 mb-2">No Data Loaded</h3>
          <p className="text-sm">Import an Excel file or use the DoorDash extension to preview</p>
        </div>
      </div>
    );
  }

  if (!selectedMenuId) {
    return (
      <div className="flex items-center justify-center h-full rounded-lg bg-[hsl(var(--pos-shell))] border border-[hsl(var(--pos-shell-border))] text-zinc-400">
        <p>Select a menu to preview</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={cn(
        'pos-preview-dark flex flex-col h-full min-h-0 rounded-lg overflow-hidden',
        'border border-[hsl(var(--pos-shell-border))] bg-[hsl(var(--pos-shell))] text-[hsl(var(--pos-text))]',
      )}
    >
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between gap-4 px-3 py-2.5 shrink-0 border-b border-[hsl(var(--pos-shell-border))] bg-[hsl(var(--pos-shell-elevated))]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="p-1.5 rounded-md text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div
            className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-emerald-400 via-teal-500 to-violet-600"
            aria-hidden
          />
          <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
        </div>

        <div className="text-sm font-medium tabular-nums text-zinc-200">{timeStr}</div>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 text-xs font-medium hover:bg-white/5"
          >
            <Lock className="w-3.5 h-3.5" />
            Lock screen
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Take break</span>
          </button>
          <div className="flex items-center gap-1.5 pl-2 sm:border-l border-zinc-700 text-zinc-300">
            <User className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm truncate max-w-[100px]">John Doe</span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: ticket ── */}
        <aside className="w-[min(100%,320px)] sm:w-[26%] flex flex-col min-w-0 border-r border-[hsl(var(--pos-shell-border))] bg-[hsl(var(--pos-ticket-bg))]">
          {/* Ticket header */}
          <div className="p-3 border-b border-[hsl(var(--pos-shell-border))] flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Ticket 1</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Table 1 | John Doe</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-red-600 text-white">
                Unpaid
              </span>
              <button type="button" className="p-1 text-zinc-500 hover:text-zinc-300">
                <UtensilsCrossed className="w-4 h-4" />
              </button>
              <button type="button" className="p-1 text-zinc-500 hover:text-zinc-300">
                <ShoppingBag className="w-4 h-4" />
              </button>
              <button type="button" className="p-1 text-zinc-500 hover:text-zinc-300">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ticket lines */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1 text-[11px] text-zinc-500 border-b border-zinc-800 pb-1 mb-2 font-medium uppercase tracking-wide">
              <span>Item Name</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
            </div>

            {ticketLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-600">
                <UtensilsCrossed className="w-8 h-8 opacity-40" />
                <p className="text-xs text-center">
                  {posMode === 'tsr'
                    ? 'Select an item from the menu to add it here'
                    : 'Tap an item tile to add it'}
                </p>
              </div>
            ) : (
              ticketLines.map((line) => (
                <div
                  key={line.lineId}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-0.5 py-2 border-b border-zinc-800/80 text-sm group"
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-medium text-zinc-100 truncate text-xs leading-snug">
                        {line.item.posDisplayName || line.item.itemName}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFromTicket(line.lineId)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {Object.entries(line.selectedOptions).length > 0 && (
                      <TicketLineOptions line={line} />
                    )}
                  </div>
                  <span className="text-zinc-400 tabular-nums text-right text-xs">{line.qty}</span>
                  <span className="text-zinc-400 tabular-nums text-right text-xs">
                    ${line.item.itemPrice.toFixed(2)}
                  </span>
                  <span className="text-zinc-200 font-medium tabular-nums text-right text-xs">
                    ${(line.item.itemPrice * line.qty).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Ticket footer */}
          <div className="p-3 border-t border-[hsl(var(--pos-shell-border))] space-y-2 bg-[hsl(var(--pos-shell))]">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Service charges (0%)</span>
              <span className="tabular-nums">$0.00</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="space-y-1 text-zinc-500">
                <div className="flex justify-between">
                  <span>Credits</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Discounts</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Tips</span>
                  <span className="tabular-nums">$0.00</span>
                </div>
              </div>
              <div className="space-y-1 text-zinc-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span className="tabular-nums">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-zinc-100">
                  <span>Total</span>
                  <span className="tabular-nums">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={clearTicket}
                className="flex-1 py-2.5 rounded-lg border border-zinc-600 text-sm text-zinc-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 rounded-lg border border-zinc-600 text-sm text-zinc-300 hover:bg-white/5"
              >
                Print
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-[hsl(var(--pos-pay))] hover:bg-[hsl(var(--pos-pay-hover))]"
              >
                Pay
              </button>
            </div>
          </div>
        </aside>

        {/* ── Right: menu panel ── */}
        <section className="flex-1 flex flex-col min-w-0 bg-[hsl(var(--pos-shell))]">
          {/* Menu bar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[hsl(var(--pos-shell-border))] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Select
                value={selectedMenuId?.toString() ?? ''}
                onValueChange={(v) => setSelectedMenu(v ? parseInt(v, 10) : null)}
              >
                <SelectTrigger className="w-[min(180px,40vw)] h-9 bg-[hsl(var(--pos-menu-tile))] border-zinc-700 text-zinc-100 text-sm">
                  <SelectValue placeholder="Menu" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {menus.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()} className="text-zinc-100">
                      {m.menuName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* QSR / TSR toggle */}
              <div className="flex rounded-lg border border-zinc-700 overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setPosMode('qsr')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-colors',
                    posMode === 'qsr'
                      ? 'bg-orange-500 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
                  )}
                >
                  QSR
                </button>
                <button
                  type="button"
                  onClick={() => setPosMode('tsr')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-colors border-l border-zinc-700',
                    posMode === 'tsr'
                      ? 'bg-orange-500 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
                  )}
                >
                  TSR
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-2 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                aria-label="Filter"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Menu content */}
          <div
            className={cn(
              'flex-1 min-h-0',
              posMode === 'qsr' && 'overflow-x-auto overflow-y-hidden p-3',
            )}
          >
            {posMode === 'qsr' ? (
              <QSRMenuPanel onAddToTicket={(item) => addToTicket(item, {}, 1)} />
            ) : (
              <TSRMenuPanel onAddToTicket={addToTicket} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: display selected modifier option names on a ticket line
// ---------------------------------------------------------------------------

function TicketLineOptions({ line }: { line: TicketLine }) {
  const { modifiers, modifierOptions } = useMenuStore();

  const labels: string[] = [];
  for (const [modifierIdStr, optionIds] of Object.entries(line.selectedOptions)) {
    const modifierId = parseInt(modifierIdStr, 10);
    const modifier = modifiers.find((m) => m.id === modifierId);
    for (const optionId of optionIds) {
      const option = modifierOptions.find((o) => o.id === optionId);
      if (option) {
        const label = modifier
          ? `${modifier.posDisplayName || modifier.modifierName}: ${option.posDisplayName || option.optionName}`
          : option.posDisplayName || option.optionName;
        labels.push(label);
      }
    }
  }

  if (labels.length === 0) return null;

  return (
    <div className="mt-0.5 space-y-px">
      {labels.map((label, i) => (
        <p key={i} className="text-[10px] text-zinc-500 truncate">
          {label}
        </p>
      ))}
    </div>
  );
}
