import { useMemo, useState, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { shortenName } from '@/lib/shortenName';
import {
  Upload,
  Plus,
  Menu,
  ChevronRight,
  Lock,
  Clock,
  User,
  Search,
  Filter,
  MoreVertical,
  UtensilsCrossed,
  ShoppingBag,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Category, Item } from '@/types/menu';

const CATEGORY_COLORS = [
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
];

const TAX_RATE = 0.05;

export function POSPreview() {
  const {
    categories,
    items,
    categoryItems,
    menus,
    selectedMenuId,
    setSelectedMenu,
    selectedItemId,
    setSelectedItem,
    isDataLoaded,
    addCategory,
    getNextId,
  } = useMenuStore();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  const rootCategories = useMemo(() => {
    if (!selectedMenuId) return [];
    return categories
      .filter((c) => {
        const menuIdList =
          c.menuIds?.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id)) || [];
        return menuIdList.includes(selectedMenuId) && !c.parentCategoryId;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, selectedMenuId]);

  /** One column per root category: items in that category + subcategories */
  const menuColumns = useMemo(() => {
    if (!selectedMenuId) return [] as { category: Category; items: Item[] }[];
    return rootCategories.map((cat) => {
      const subcats = categories.filter((c) => c.parentCategoryId === cat.id);
      const catIds = [cat.id, ...subcats.map((s) => s.id)];
      const rows = categoryItems
        .filter((ci) => catIds.includes(ci.categoryId))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const seen = new Set<number>();
      const ordered: Item[] = [];
      for (const ci of rows) {
        if (seen.has(ci.itemId)) continue;
        seen.add(ci.itemId);
        const item = items.find((i) => i.id === ci.itemId);
        if (item) ordered.push(item);
      }
      return { category: cat, items: ordered };
    });
  }, [selectedMenuId, rootCategories, categories, categoryItems, items]);

  /** Demo ticket: first few items from the menu (preview only — no cart in app) */
  const ticketLines = useMemo(() => {
    const flat: Item[] = [];
    for (const col of menuColumns) flat.push(...col.items);
    return flat.slice(0, 4);
  }, [menuColumns]);

  const subtotal = useMemo(
    () => ticketLines.reduce((s, i) => s + i.itemPrice, 0),
    [ticketLines],
  );
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const handleAddCategory = () => {
    if (!newCategoryName.trim() || !selectedMenuId) return;

    const newCategoryId = getNextId('categories');
    const name = newCategoryName.trim();
    const newCategory: Category = {
      id: newCategoryId,
      categoryName: name,
      posDisplayName: name,
      kdsDisplayName: name,
      menuIds: selectedMenuId.toString(),
      parentCategoryId: null,
      sortOrder: rootCategories.length,
      color: newCategoryColor,
      image: '',
      kioskImage: '',
      tagIds: '',
    };

    addCategory(newCategory);
    setNewCategoryName('');
    setNewCategoryColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
    setShowAddCategory(false);
  };

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

  return (
    <div
      className={cn(
        'pos-preview-dark flex flex-col h-full min-h-0 rounded-lg overflow-hidden',
        'border border-[hsl(var(--pos-shell-border))] bg-[hsl(var(--pos-shell))] text-[hsl(var(--pos-text))]',
      )}
    >
      {/* Top bar — matches POS shell */}
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

      <div className="flex flex-1 min-h-0">
        {/* Left: ticket */}
        <aside className="w-[min(100%,420px)] sm:w-[38%] flex flex-col min-w-0 border-r border-[hsl(var(--pos-shell-border))] bg-[hsl(var(--pos-ticket-bg))]">
          <div className="p-3 border-b border-[hsl(var(--pos-shell-border))] flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Ticket 1</h2>
              <button type="button" className="text-xs text-violet-400 hover:underline mt-0.5">
                Add Guest
              </button>
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

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1 text-[11px] text-zinc-500 border-b border-zinc-800 pb-1 mb-2 font-medium uppercase tracking-wide">
              <span>Item Name</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
            </div>
            {ticketLines.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">No items in menu to preview</p>
            ) : (
              ticketLines.map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-0.5 py-2 border-b border-zinc-800/80 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100 truncate">{line.posDisplayName || line.itemName}</p>
                    {line.itemDescription ? (
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{line.itemDescription}</p>
                    ) : null}
                  </div>
                  <span className="text-zinc-400 tabular-nums text-right">1</span>
                  <span className="text-zinc-400 tabular-nums text-right">${line.itemPrice.toFixed(2)}</span>
                  <span className="text-zinc-200 font-medium tabular-nums text-right">${line.itemPrice.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-[hsl(var(--pos-shell-border))] space-y-2 bg-[hsl(var(--pos-shell))]">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Service charges (0%)</span>
              <span className="tabular-nums">$0.00</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="space-y-1 text-zinc-500">
                <div className="flex justify-between"><span>Credits</span><span className="tabular-nums">$0.00</span></div>
                <div className="flex justify-between"><span>Discounts</span><span className="tabular-nums">$0.00</span></div>
                <div className="flex justify-between"><span>Tips</span><span className="tabular-nums">$0.00</span></div>
              </div>
              <div className="space-y-1 text-zinc-300">
                <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">${tax.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold text-zinc-100"><span>Total</span><span className="tabular-nums">${total.toFixed(2)}</span></div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
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

        {/* Right: menu — category columns */}
        <section className="flex-1 flex flex-col min-w-0 bg-[hsl(var(--pos-shell))]">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[hsl(var(--pos-shell-border))] shrink-0">
            <Select
              value={selectedMenuId?.toString() ?? ''}
              onValueChange={(v) => setSelectedMenu(v ? parseInt(v, 10) : null)}
            >
              <SelectTrigger className="w-[min(220px,45vw)] h-9 bg-[hsl(var(--pos-menu-tile))] border-zinc-700 text-zinc-100 text-sm">
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

          <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 p-3">
            <div className="flex gap-3 h-full min-h-[200px]">
              {menuColumns.map(({ category, items: colItems }) => {
                const accent = category.color || '#f97316';
                return (
                  <div
                    key={category.id}
                    className="flex flex-col gap-2 w-[148px] sm:w-[160px] shrink-0 h-full min-h-0"
                  >
                    <div
                      className="rounded-md px-2 py-2.5 text-center text-xs font-semibold text-white shadow-sm shrink-0 leading-tight"
                      style={{ backgroundColor: accent }}
                    >
                      {category.categoryName}
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5">
                      {colItems.map((item) => {
                        const selected = selectedItemId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedItem(item.id)}
                            className={cn(
                              'flex flex-col items-stretch rounded-md px-2.5 py-2.5 text-left transition-colors',
                              'bg-[hsl(var(--pos-menu-tile))] border border-zinc-700/80',
                              'hover:border-zinc-500 hover:bg-zinc-800/80',
                              selected && 'ring-2 ring-orange-500 border-orange-500/60 bg-zinc-800',
                              item.stockStatus !== 'inStock' && 'opacity-45 border-red-900/50',
                            )}
                            style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                          >
                            <span
                              className={cn(
                                'text-[12px] font-medium leading-snug text-zinc-100 line-clamp-3',
                                item.stockStatus !== 'inStock' && 'line-through',
                              )}
                            >
                              {shortenName(item.posDisplayName || item.itemName)}
                            </span>
                            <span className="text-[11px] font-semibold text-orange-400 mt-1 tabular-nums">
                              ${item.itemPrice.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                      {colItems.length === 0 && (
                        <p className="text-[10px] text-zinc-600 text-center py-4">Empty</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setShowAddCategory(true)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-[100px] shrink-0 rounded-lg border-2 border-dashed border-zinc-700',
                  'text-zinc-500 hover:border-orange-500/50 hover:text-zinc-400 hover:bg-white/[0.02]',
                )}
                title="Add category"
              >
                <Plus className="w-6 h-6" />
                <span className="text-[10px]">Add</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>Create a new category for this menu</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="e.g., Appetizers"
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Category Color</Label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCategoryColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      newCategoryColor === color && 'ring-2 ring-offset-2 ring-primary',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setShowAddCategory(false)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  newCategoryName.trim()
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                Add Category
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
