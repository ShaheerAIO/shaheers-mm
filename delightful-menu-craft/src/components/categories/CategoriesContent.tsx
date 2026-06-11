import { useState, useCallback } from 'react';
import { Filter, Search, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { BulkColumns, EMPTY_FILTERS, type BulkFilters } from './BulkColumns';
import { BulkEditPanel } from './BulkEditPanel';
import { useBulkSelection } from './useBulkSelection';
import type {
  Category,
  Item,
  ItemModifier,
  Menu,
  Modifier,
  ModifierModifierOption,
  ModifierOption,
} from '@/types/menu';

/** Slices restored by "Undo last apply" — everything a bulk edit can touch. */
interface BulkUndoSnapshot {
  menus: Menu[];
  categories: Category[];
  items: Item[];
  modifiers: Modifier[];
  modifierOptions: ModifierOption[];
  itemModifiers: ItemModifier[];
  modifierModifierOptions: ModifierModifierOption[];
}

export function CategoriesContent() {
  const menus = useMenuStore((s) => s.menus);
  const categories = useMenuStore((s) => s.categories);
  const items = useMenuStore((s) => s.items);
  const modifiers = useMenuStore((s) => s.modifiers);
  const modifierOptions = useMenuStore((s) => s.modifierOptions);
  const isDataLoaded = useMenuStore((s) => s.isDataLoaded);
  const bulkUpdateItems = useMenuStore((s) => s.bulkUpdateItems);
  const bulkUpdateModifierOptions = useMenuStore((s) => s.bulkUpdateModifierOptions);

  const tags = useMenuStore((s) => s.tags);
  const allergens = useMenuStore((s) => s.allergens);
  const stations = useMenuStore((s) => s.stations);

  const selection = useBulkSelection();
  const { selected, selectedIdsAt, clear } = selection;
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<BulkFilters>(EMPTY_FILTERS);
  const [undoSnapshot, setUndoSnapshot] = useState<BulkUndoSnapshot | null>(null);

  const activeFilterCount =
    (filters.stock !== 'all' ? 1 : 0) +
    (filters.stationId != null ? 1 : 0) +
    (filters.tagId != null ? 1 : 0) +
    (filters.allergenId != null ? 1 : 0);

  const captureUndo = useCallback(() => {
    const s = useMenuStore.getState();
    setUndoSnapshot({
      menus: s.menus,
      categories: s.categories,
      items: s.items,
      modifiers: s.modifiers,
      modifierOptions: s.modifierOptions,
      itemModifiers: s.itemModifiers,
      modifierModifierOptions: s.modifierModifierOptions,
    });
  }, []);

  const undoLastApply = () => {
    if (!undoSnapshot) return;
    useMenuStore.setState(undoSnapshot);
    setUndoSnapshot(null);
    toast.success('Reverted last bulk apply');
  };

  const selItemIds = selectedIdsAt('item');
  const selOptionIds = selectedIdsAt('option');

  /** Quick stock action — applies immediately to directly-checked items & options. */
  const quickStock = (inStock: boolean) => {
    captureUndo();
    if (selItemIds.length) {
      bulkUpdateItems(selItemIds, () => ({
        stockStatus: inStock ? 'inStock' : 'outOfStock',
      }));
    }
    if (selOptionIds.length) {
      bulkUpdateModifierOptions(selOptionIds, () => ({
        isStockAvailable: inStock,
      }));
    }
    const n = selItemIds.length + selOptionIds.length;
    toast.success(`Marked ${n} record${n !== 1 ? 's' : ''} ${inStock ? 'In Stock' : '86’ed'}`);
  };

  const outOfStock =
    items.filter((i) => i.stockStatus === 'outOfStock').length +
    modifierOptions.filter((o) => !o.isStockAvailable).length;

  const cards: { label: string; value: number; tone?: 'bad' }[] = [
    { label: 'Menus', value: menus.length },
    { label: 'Categories', value: categories.length },
    { label: 'Items', value: items.length },
    { label: 'Modifiers', value: modifiers.length },
    { label: 'Options', value: modifierOptions.length },
    { label: 'Out of Stock', value: outOfStock, tone: 'bad' },
  ];

  // Directly-checked counts — bulk edits act on these, not the cascade.
  const selParts: { level: string; count: number }[] = [
    { level: 'menus', count: selectedIdsAt('menu').length },
    { level: 'categories', count: selectedIdsAt('category').length },
    { level: 'items', count: selItemIds.length },
    { level: 'modifiers', count: selectedIdsAt('modifier').length },
    { level: 'options', count: selOptionIds.length },
  ];
  const reachParts = selParts.filter((p) => p.count > 0).map((p) => `${p.count} ${p.level}`);

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Import an Excel file to start bulk-managing your menu
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold">Bulk Menu Management</h1>
            <p className="text-xs text-muted-foreground">
              Drill across the hierarchy — edits cascade down from your selection
            </p>
          </div>
          <div className="flex gap-2 ml-auto">
            {cards.map((c) => (
              <div
                key={c.label}
                className="px-3 py-1.5 rounded-lg border border-border bg-card min-w-[72px]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {c.label}
                </p>
                <p
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    c.tone === 'bad' && c.value > 0 && 'text-destructive',
                  )}
                >
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any menu, category, item, modifier or option..."
            className="input-field w-full pl-7 text-xs h-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
            filtersOpen || activeFilterCount > 0
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={undoLastApply}
          disabled={!undoSnapshot}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
            undoSnapshot
              ? 'border-border bg-card text-foreground hover:bg-muted'
              : 'border-border text-muted-foreground/50 cursor-not-allowed',
          )}
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo last apply
        </button>
      </div>

      {/* Filters */}
      {filtersOpen && (
        <div className="px-4 py-2 border-b border-border shrink-0 flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Stock</label>
            <select
              value={filters.stock}
              onChange={(e) => setFilters((f) => ({ ...f, stock: e.target.value as BulkFilters['stock'] }))}
              className="input-field text-xs h-8 min-w-[120px]"
            >
              <option value="all">All</option>
              <option value="in">In Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Station</label>
            <select
              value={filters.stationId ?? 'all'}
              onChange={(e) => setFilters((f) => ({ ...f, stationId: e.target.value === 'all' ? null : +e.target.value }))}
              className="input-field text-xs h-8 min-w-[120px]"
            >
              <option value="all">All</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>{s.label || `Station ${s.id}`}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Tag</label>
            <select
              value={filters.tagId ?? 'all'}
              onChange={(e) => setFilters((f) => ({ ...f, tagId: e.target.value === 'all' ? null : +e.target.value }))}
              className="input-field text-xs h-8 min-w-[120px]"
            >
              <option value="all">All</option>
              {tags.filter((t) => t.id > 0 && t.name.trim()).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Allergen</label>
            <select
              value={filters.allergenId ?? 'all'}
              onChange={(e) => setFilters((f) => ({ ...f, allergenId: e.target.value === 'all' ? null : +e.target.value }))}
              className="input-field text-xs h-8 min-w-[120px]"
            >
              <option value="all">All</option>
              {allergens.filter((a) => a.id > 0 && a.name.trim()).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => { setFilters(EMPTY_FILTERS); setSearch(''); }}
            className="h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="px-4 py-1.5 border-b border-primary/30 bg-primary/5 shrink-0 flex items-center gap-3 text-xs">
          <span className="font-semibold text-primary">{reachParts.join(' · ')} selected</span>
          <div className="ml-auto flex items-center gap-2">
            {(selItemIds.length > 0 || selOptionIds.length > 0) && (
              <>
                <button
                  type="button"
                  onClick={() => quickStock(true)}
                  className="px-2 py-1 rounded border border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400 font-medium transition-colors hover:bg-green-500/20"
                >
                  Mark In Stock
                </button>
                <button
                  type="button"
                  onClick={() => quickStock(false)}
                  className="px-2 py-1 rounded border border-destructive/40 bg-destructive/10 text-destructive font-medium transition-colors hover:bg-destructive/20"
                >
                  Mark 86’ed
                </button>
              </>
            )}
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Columns + bulk panel (panel pops in once something is checked, instead of always occupying space) */}
      <div className="flex-1 flex min-h-0">
        <BulkColumns selection={selection} search={search} filters={filters} />
        {selected.size > 0 && (
          <div className="w-[384px] shrink-0 border-l border-border bg-background shadow-2xl flex flex-col min-h-0 animate-in slide-in-from-right duration-200">
            <BulkEditPanel
              selection={selection}
              onClearSelection={clear}
              captureUndo={captureUndo}
            />
          </div>
        )}
      </div>
    </div>
  );
}
