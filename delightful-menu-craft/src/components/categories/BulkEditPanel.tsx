import { useState } from 'react';
import { Check } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import type { Item } from '@/types/menu';

const VIS_CHANNELS = [
  { key: 'visibilityPos' as const, label: 'POS' },
  { key: 'visibilityKiosk' as const, label: 'Kiosk' },
  { key: 'visibilityQr' as const, label: 'QR' },
  { key: 'visibilityWebsite' as const, label: 'Website' },
  { key: 'visibilityMobileApp' as const, label: 'Mobile App' },
  { key: 'visibilityDoordash' as const, label: 'DoorDash' },
];

type PriceMode = 'set' | 'add' | 'subtract' | 'percent-add' | 'percent-subtract';

const PRICE_MODES: { value: PriceMode; label: string }[] = [
  { value: 'set', label: 'Set to $' },
  { value: 'add', label: '+$' },
  { value: 'subtract', label: '−$' },
  { value: 'percent-add', label: '+%' },
  { value: 'percent-subtract', label: '−%' },
];

function parseIdsCsv(csv: string | undefined): number[] {
  if (!csv?.trim()) return [];
  return csv.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
}

function mergeIds(existing: string | undefined, toAdd: number[]): string {
  const set = new Set([...parseIdsCsv(existing), ...toAdd]);
  return [...set].join(',');
}

function removeIds(existing: string | undefined, toRemove: number[]): string {
  const removeSet = new Set(toRemove);
  return parseIdsCsv(existing).filter((id) => !removeSet.has(id)).join(',');
}

function applyPriceCalc(current: number, mode: PriceMode, value: number): number {
  let result: number;
  switch (mode) {
    case 'set':            result = value; break;
    case 'add':            result = current + value; break;
    case 'subtract':       result = current - value; break;
    case 'percent-add':    result = current * (1 + value / 100); break;
    case 'percent-subtract': result = current * (1 - value / 100); break;
    default:               result = current;
  }
  return Math.max(0, Math.round(result * 100) / 100);
}

interface BulkEditPanelProps {
  selectedItemIds: Set<number>;
  onClearSelection: () => void;
}

export function BulkEditPanel({ selectedItemIds, onClearSelection }: BulkEditPanelProps) {
  const { items, tags, allergens, stations, bulkUpdateItems } = useMenuStore();

  const validTags = tags.filter((t) => t.id > 0 && t.name.trim().length > 0);
  const validAllergens = allergens.filter((a) => a.id > 0 && a.name.trim().length > 0);

  // Visibility
  const [applyVisibility, setApplyVisibility] = useState(false);
  const [vis, setVis] = useState({
    visibilityPos: true,
    visibilityKiosk: true,
    visibilityQr: true,
    visibilityWebsite: true,
    visibilityMobileApp: true,
    visibilityDoordash: true,
  });

  // Price
  const [applyPriceSection, setApplyPriceFlag] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode>('set');
  const [priceValue, setPriceValue] = useState('');

  // Stock
  const [stockAction, setStockAction] = useState<'none' | 'inStock' | 'outOfStock'>('none');

  // Tags
  const [tagAddIds, setTagAddIds] = useState<Set<number>>(new Set());
  const [tagRemoveIds, setTagRemoveIds] = useState<Set<number>>(new Set());

  // Allergens
  const [allergenAddIds, setAllergenAddIds] = useState<Set<number>>(new Set());
  const [allergenRemoveIds, setAllergenRemoveIds] = useState<Set<number>>(new Set());

  // Stations
  const [stationAddIds, setStationAddIds] = useState<Set<number>>(new Set());
  const [stationRemoveIds, setStationRemoveIds] = useState<Set<number>>(new Set());

  const count = selectedItemIds.size;

  const buildSummary = () => {
    const parts: string[] = [];
    if (applyVisibility) parts.push('visibility');
    if (applyPriceSection && priceValue) parts.push(`price (${PRICE_MODES.find((m) => m.value === priceMode)?.label}${priceValue})`);
    if (stockAction !== 'none') parts.push(`stock → ${stockAction === 'inStock' ? 'In Stock' : 'Out of Stock'}`);
    if (tagAddIds.size) parts.push(`+${tagAddIds.size} tag(s)`);
    if (tagRemoveIds.size) parts.push(`−${tagRemoveIds.size} tag(s)`);
    if (allergenAddIds.size) parts.push(`+${allergenAddIds.size} allergen(s)`);
    if (allergenRemoveIds.size) parts.push(`−${allergenRemoveIds.size} allergen(s)`);
    if (stationAddIds.size) parts.push(`+${stationAddIds.size} station(s)`);
    if (stationRemoveIds.size) parts.push(`−${stationRemoveIds.size} station(s)`);
    return parts.length ? parts.join(', ') : null;
  };

  const handleApply = () => {
    const numericPrice = parseFloat(priceValue);
    bulkUpdateItems([...selectedItemIds], (item: Item): Partial<Item> => {
      const updates: Partial<Item> = {};

      if (applyVisibility) {
        Object.assign(updates, vis);
      }

      if (applyPriceSection && priceValue && !isNaN(numericPrice)) {
        updates.itemPrice = applyPriceCalc(item.itemPrice, priceMode, numericPrice);
      }

      if (stockAction !== 'none') {
        updates.stockStatus = stockAction;
      }

      if (tagAddIds.size || tagRemoveIds.size) {
        let t = item.tagIds;
        if (tagAddIds.size) t = mergeIds(t, [...tagAddIds]);
        if (tagRemoveIds.size) t = removeIds(t, [...tagRemoveIds]);
        updates.tagIds = t;
      }

      if (allergenAddIds.size || allergenRemoveIds.size) {
        let a = item.allergenIds;
        if (allergenAddIds.size) a = mergeIds(a, [...allergenAddIds]);
        if (allergenRemoveIds.size) a = removeIds(a, [...allergenRemoveIds]);
        updates.allergenIds = a;
      }

      if (stationAddIds.size || stationRemoveIds.size) {
        let s = item.stationIds;
        if (stationAddIds.size) s = mergeIds(s, [...stationAddIds]);
        if (stationRemoveIds.size) s = removeIds(s, [...stationRemoveIds]);
        updates.stationIds = s;
      }

      return updates;
    });

    onClearSelection();
  };

  const summary = buildSummary();

  const toggleChipAdd = (id: number, addSet: Set<number>, setAdd: (s: Set<number>) => void, removeSet: Set<number>, setRemove: (s: Set<number>) => void) => {
    const a = new Set(addSet);
    const r = new Set(removeSet);
    if (a.has(id)) { a.delete(id); }
    else { a.add(id); r.delete(id); }
    setAdd(a);
    setRemove(r);
  };

  const toggleChipRemove = (id: number, addSet: Set<number>, setAdd: (s: Set<number>) => void, removeSet: Set<number>, setRemove: (s: Set<number>) => void) => {
    const a = new Set(addSet);
    const r = new Set(removeSet);
    if (r.has(id)) { r.delete(id); }
    else { r.add(id); a.delete(id); }
    setAdd(a);
    setRemove(r);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{count} item{count !== 1 ? 's' : ''} selected</h2>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Changes apply to all selected items</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-5">

          {/* Visibility */}
          <section>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input type="checkbox" checked={applyVisibility} onChange={(e) => setApplyVisibility(e.target.checked)} className="accent-primary cursor-pointer" />
              <span className="section-header">Visibility</span>
            </label>
            {applyVisibility && (
              <div className="space-y-2 pl-5">
                {VIS_CHANNELS.map((ch) => (
                  <label key={ch.key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-muted-foreground">{ch.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={vis[ch.key]}
                      onClick={() => setVis((v) => ({ ...v, [ch.key]: !v[ch.key] }))}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
                        vis[ch.key] ? 'bg-primary' : 'bg-muted',
                      )}
                    >
                      <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', vis[ch.key] ? 'translate-x-4' : 'translate-x-0')} />
                    </button>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Price */}
          <section>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input type="checkbox" checked={applyPriceSection} onChange={(e) => setApplyPriceFlag(e.target.checked)} className="accent-primary cursor-pointer" />
              <span className="section-header">Price</span>
            </label>
            {applyPriceSection && (
              <div className="pl-5 flex items-center gap-2">
                <select
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as PriceMode)}
                  className="input-field text-xs h-8"
                >
                  {PRICE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step={priceMode.includes('percent') ? 1 : 0.01}
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  placeholder={priceMode.includes('percent') ? '10' : '0.00'}
                  className="input-field w-24 text-xs h-8"
                />
              </div>
            )}
          </section>

          {/* Stock */}
          <section>
            <p className="section-header mb-2">Stock status</p>
            <div className="flex gap-2">
              {(['none', 'inStock', 'outOfStock'] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStockAction(val)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    stockAction === val
                      ? val === 'outOfStock'
                        ? 'bg-destructive/10 border-destructive/40 text-destructive'
                        : val === 'inStock'
                          ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400'
                          : 'bg-muted border-border text-muted-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {val === 'none' ? 'No change' : val === 'inStock' ? 'In Stock' : 'Out of Stock'}
                </button>
              ))}
            </div>
          </section>

          {/* Tags */}
          {validTags.length > 0 && (
            <section>
              <p className="section-header mb-1">Tags</p>
              <p className="text-[10px] text-muted-foreground mb-2">Click once to add, twice to remove, third to clear</p>
              <div className="flex flex-wrap gap-1.5">
                {validTags.map((tag) => {
                  const isAdd = tagAddIds.has(tag.id);
                  const isRemove = tagRemoveIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        if (!isAdd && !isRemove) toggleChipAdd(tag.id, tagAddIds, setTagAddIds, tagRemoveIds, setTagRemoveIds);
                        else if (isAdd) toggleChipRemove(tag.id, tagAddIds, setTagAddIds, tagRemoveIds, setTagRemoveIds);
                        else { const r = new Set(tagRemoveIds); r.delete(tag.id); setTagRemoveIds(r); }
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                        isAdd ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400'
                          : isRemove ? 'bg-destructive/10 border-destructive/40 text-destructive'
                          : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30',
                      )}
                    >
                      {isAdd && <span className="font-bold">+</span>}
                      {isRemove && <span className="font-bold">−</span>}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Allergens */}
          {validAllergens.length > 0 && (
            <section>
              <p className="section-header mb-1">Allergens</p>
              <p className="text-[10px] text-muted-foreground mb-2">Click once to add, twice to remove, third to clear</p>
              <div className="flex flex-wrap gap-1.5">
                {validAllergens.map((allergen) => {
                  const isAdd = allergenAddIds.has(allergen.id);
                  const isRemove = allergenRemoveIds.has(allergen.id);
                  return (
                    <button
                      key={allergen.id}
                      type="button"
                      onClick={() => {
                        if (!isAdd && !isRemove) toggleChipAdd(allergen.id, allergenAddIds, setAllergenAddIds, allergenRemoveIds, setAllergenRemoveIds);
                        else if (isAdd) toggleChipRemove(allergen.id, allergenAddIds, setAllergenAddIds, allergenRemoveIds, setAllergenRemoveIds);
                        else { const r = new Set(allergenRemoveIds); r.delete(allergen.id); setAllergenRemoveIds(r); }
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                        isAdd ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400'
                          : isRemove ? 'bg-destructive/10 border-destructive/40 text-destructive'
                          : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30',
                      )}
                    >
                      {isAdd && <span className="font-bold">+</span>}
                      {isRemove && <span className="font-bold">−</span>}
                      {allergen.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Stations */}
          {stations.length > 0 && (
            <section>
              <p className="section-header mb-1">Stations</p>
              <p className="text-[10px] text-muted-foreground mb-2">Click once to add, twice to remove, third to clear</p>
              <div className="flex flex-wrap gap-1.5">
                {stations.map((station) => {
                  const isAdd = stationAddIds.has(station.id);
                  const isRemove = stationRemoveIds.has(station.id);
                  return (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => {
                        if (!isAdd && !isRemove) toggleChipAdd(station.id, stationAddIds, setStationAddIds, stationRemoveIds, setStationRemoveIds);
                        else if (isAdd) toggleChipRemove(station.id, stationAddIds, setStationAddIds, stationRemoveIds, setStationRemoveIds);
                        else { const r = new Set(stationRemoveIds); r.delete(station.id); setStationRemoveIds(r); }
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                        isAdd ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400'
                          : isRemove ? 'bg-destructive/10 border-destructive/40 text-destructive'
                          : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30',
                      )}
                    >
                      {isAdd && <span className="font-bold">+</span>}
                      {isRemove && <span className="font-bold">−</span>}
                      Station {station.id}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Apply button */}
      <div className="shrink-0 px-4 py-3 border-t border-border space-y-2">
        {summary && (
          <p className="text-[10px] text-muted-foreground leading-snug">
            Will update {count} item{count !== 1 ? 's' : ''}: {summary}
          </p>
        )}
        <button
          type="button"
          onClick={handleApply}
          disabled={!summary}
          className={cn(
            'w-full py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
            summary
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          <Check className="w-3.5 h-3.5" />
          Apply to {count} item{count !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
