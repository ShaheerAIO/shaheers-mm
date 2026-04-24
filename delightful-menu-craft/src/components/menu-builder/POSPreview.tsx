import { useMemo, useState, useEffect, useCallback } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import {
  Upload,
  Search,
  Filter,
  UtensilsCrossed,
  ShoppingBag,
  MoreVertical,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Item, ModifierModifierOption } from '@/types/menu';
import { QSRMenuPanel } from './pos-preview/QSRMenuPanel';
import { TSRMenuPanel } from './pos-preview/TSRMenuPanel';
import { ModifierPanel } from './pos-preview/ModifierPanel';

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

/** Sum join-table `maxLimit` for each selected option occurrence (duplicates = multi-qty). */
function modifierSurchargePerUnit(
  selectedOptions: Record<number, number[]>,
  modifierModifierOptions: ModifierModifierOption[],
): number {
  let sum = 0;
  for (const [modIdStr, ids] of Object.entries(selectedOptions)) {
    const modId = Number(modIdStr);
    if (!Number.isFinite(modId)) continue;
    if (!Array.isArray(ids)) continue;
    for (const optionId of ids) {
      const mmo = modifierModifierOptions.find(
        (m) => m.modifierId === modId && m.modifierOptionId === optionId,
      );
      sum += mmo?.maxLimit ?? 0;
    }
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function POSPreview() {
  const { menus, selectedMenuId, setSelectedMenu, isDataLoaded, itemModifiers, modifierModifierOptions } =
    useMenuStore();

  // POS mode toggle
  const [posMode, setPosMode] = useState<PosMode>('tsr');

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchToggle = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchQuery('');
    } else {
      setSearchOpen(true);
    }
  };

  const handleSetPosMode = (mode: PosMode) => {
    setPosMode(mode);
    setSearchOpen(false);
    setSearchQuery('');
  };

  // Local ticket state
  const [ticketLines, setTicketLines] = useState<TicketLine[]>([]);

  // QSR modifier panel state
  const [qsrModifierItem, setQsrModifierItem] = useState<Item | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  /** Bumps when opening the modifier panel for a *new* line so React remounts with fresh state. */
  const [qsrModifierNewInstance, setQsrModifierNewInstance] = useState(0);

  /** Dims ticket when modifier panel is open and Done is not yet allowed (QSR + TSR). */
  const [ticketModifierBlocked, setTicketModifierBlocked] = useState(false);
  const handleModifierTicketBlock = useCallback((blocked: boolean) => {
    setTicketModifierBlocked(blocked);
  }, []);

  useEffect(() => {
    setTicketModifierBlocked(false);
  }, [posMode]);

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

  // QSR item click handler - opens modifier panel when item has modifiers,
  // otherwise fast-adds to ticket. Reads fresh state from the store directly
  // to avoid any stale-closure issues with React's render snapshot.
  const handleQsrItemClick = (item: Item) => {
    const { itemModifiers: freshItemModifiers } = useMenuStore.getState();
    const hasModifiers = freshItemModifiers.some((im) => im.itemId === item.id);
    if (!hasModifiers) {
      addToTicket(item, {}, 1);
      return;
    }
    setEditingLineId(null);
    setQsrModifierNewInstance((n) => n + 1);
    setQsrModifierItem(item);
  };

  const qsrModifierInitialSelections = useMemo(() => {
    if (!editingLineId) return undefined;
    return ticketLines.find((l) => l.lineId === editingLineId)?.selectedOptions;
  }, [editingLineId, ticketLines]);

  const qsrModifierInitialQty = useMemo(() => {
    if (!editingLineId) return undefined;
    return ticketLines.find((l) => l.lineId === editingLineId)?.qty;
  }, [editingLineId, ticketLines]);

  // Financials
  const subtotal = useMemo(
    () =>
      ticketLines.reduce((s, l) => {
        const mod = modifierSurchargePerUnit(l.selectedOptions, modifierModifierOptions);
        return s + (l.item.itemPrice + mod) * l.qty;
      }, 0),
    [ticketLines, modifierModifierOptions],
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
      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left: ticket ── */}
        <aside className="relative w-[min(100%,320px)] sm:w-[26%] flex flex-col min-w-0 border-r border-[hsl(var(--pos-shell-border))] bg-[hsl(var(--pos-ticket-bg))]">
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
              ticketLines.map((line) => {
                const hasModifiers = itemModifiers.some((im) => im.itemId === line.item.id);
                const modPerUnit = modifierSurchargePerUnit(line.selectedOptions, modifierModifierOptions);
                const lineTotal = (line.item.itemPrice + modPerUnit) * line.qty;
                return (
                <div
                  key={line.lineId}
                  onClick={() => {
                    if (posMode === 'qsr' && hasModifiers) {
                      setQsrModifierItem(line.item);
                      setEditingLineId(line.lineId);
                    }
                  }}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-0.5 py-2 border-b border-zinc-800/80 text-sm group",
                    posMode === 'qsr' && hasModifiers && "cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-medium text-zinc-100 truncate text-xs leading-snug">
                        {line.item.posDisplayName || line.item.itemName}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFromTicket(line.lineId); }}
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
                  <span className="text-zinc-400 tabular-nums text-right text-xs self-start pt-0.5">
                    {line.qty}
                  </span>
                  <div className="flex flex-col items-end gap-0.5 tabular-nums text-right text-xs self-start">
                    <span className="text-zinc-300">${line.item.itemPrice.toFixed(2)}</span>
                    {modPerUnit > 0 ? (
                      <span className="text-[10px] text-[hsl(var(--pos-accent-muted))] font-medium">
                        +${modPerUnit.toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-zinc-200 font-medium tabular-nums text-right text-xs self-start pt-0.5">
                    ${lineTotal.toFixed(2)}
                  </span>
                </div>
              );
              })
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

          {ticketModifierBlocked && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950/75 px-4 text-center backdrop-blur-sm"
              aria-live="polite"
              role="status"
            >
              <AlertCircle className="w-10 h-10 text-amber-500/90 shrink-0" aria-hidden />
              <p className="text-sm font-semibold text-zinc-100 max-w-[240px] leading-snug">
                Finish modifier selections
              </p>
              <p className="text-xs text-zinc-400 max-w-[220px] leading-relaxed">
                Complete the choices on the menu panel (same rules as Done), or press Cancel to go back.
              </p>
            </div>
          )}
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
                <SelectTrigger className="w-[min(180px,40vw)] h-9 bg-[hsl(var(--pos-menu-tile))] border-[hsl(var(--pos-shell-border))] text-zinc-100 text-sm">
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
              <div className="flex rounded-lg border border-[hsl(var(--pos-shell-border))] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetPosMode('qsr')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-colors',
                    posMode === 'qsr'
                      ? 'bg-[hsl(var(--pos-primary))] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
                  )}
                >
                  QSR
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPosMode('tsr')}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-colors border-l border-[hsl(var(--pos-shell-border))]',
                    posMode === 'tsr'
                      ? 'bg-[hsl(var(--pos-primary))] text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
                  )}
                >
                  TSR
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {searchOpen && (
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && handleSearchToggle()}
                  placeholder="Search items…"
                  className="w-36 h-7 px-2 text-xs rounded bg-zinc-800 border border-zinc-600 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
                />
              )}
              <button
                type="button"
                onClick={handleSearchToggle}
                className={cn(
                  'p-2 rounded-lg hover:bg-white/5 transition-colors',
                  searchOpen ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300',
                )}
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
              posMode === 'qsr' && qsrModifierItem && 'flex flex-col overflow-hidden',
              posMode === 'qsr' && !qsrModifierItem && 'overflow-x-auto overflow-y-hidden p-3',
            )}
          >
            {posMode === 'qsr' ? (
              qsrModifierItem ? (
                <ModifierPanel
                  key={editingLineId ?? `new-${qsrModifierNewInstance}`}
                  item={qsrModifierItem}
                  categoryColor="#f97316"
                  initialSelectedOptions={qsrModifierInitialSelections}
                  initialQty={qsrModifierInitialQty}
                  onTicketBlockChange={handleModifierTicketBlock}
                  onDone={(item, opts, qty) => {
                    if (editingLineId) {
                      // Update existing line
                      setTicketLines((prev) =>
                        prev.map((line) =>
                          line.lineId === editingLineId
                            ? { ...line, selectedOptions: opts, qty }
                            : line
                        )
                      );
                      setEditingLineId(null);
                    } else {
                      // Add new line
                      addToTicket(item, opts, qty);
                    }
                    setQsrModifierItem(null);
                  }}
                  onCancel={() => {
                    if (editingLineId) {
                      // User is editing existing item - just close panel
                      setEditingLineId(null);
                    }
                    setQsrModifierItem(null);
                  }}
                />
              ) : (
                <QSRMenuPanel onAddToTicket={handleQsrItemClick} searchQuery={searchQuery} />
              )
            ) : (
              <TSRMenuPanel
                onAddToTicket={addToTicket}
                onTicketBlockChange={handleModifierTicketBlock}
                searchQuery={searchQuery}
              />
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
