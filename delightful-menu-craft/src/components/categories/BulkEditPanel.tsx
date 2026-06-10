import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import type { Item, Modifier, ModifierOption } from '@/types/menu';
import { BulkReviewModal, type BulkOp } from './BulkReviewModal';
import { LEVEL_COLORS, type BulkLevel, type useBulkSelection } from './useBulkSelection';
import { SaleCategorySelect } from '@/components/menu-builder/SaleCategorySelect';

const VIS_CHANNELS = [
  { key: 'visibilityPos' as const, label: 'POS' },
  { key: 'visibilityKiosk' as const, label: 'Kiosk' },
  { key: 'visibilityMenuBoard' as const, label: 'Menu Board' },
  { key: 'visibilityQr' as const, label: 'QR' },
  { key: 'visibilityWebsite' as const, label: 'Website' },
  { key: 'visibilityMobileApp' as const, label: 'Mobile App' },
  { key: 'visibilityDoordash' as const, label: 'DoorDash' },
];

type VisDraft = Record<(typeof VIS_CHANNELS)[number]['key'], boolean>;
const defaultVisDraft = (): VisDraft => ({
  visibilityPos: true,
  visibilityKiosk: true,
  visibilityMenuBoard: true,
  visibilityQr: true,
  visibilityWebsite: true,
  visibilityMobileApp: true,
  visibilityDoordash: true,
});

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

const priceModeLabel = (mode: PriceMode) => PRICE_MODES.find((m) => m.value === mode)?.label ?? '';

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

/** Tri-state chip row: click once = add (green), twice = remove (red), third = clear. */
function ChipPicker({
  title,
  entries,
  addIds,
  removeIds: removeSet,
  onChange,
}: {
  title: string;
  entries: { id: number; label: string }[];
  addIds: Set<number>;
  removeIds: Set<number>;
  onChange: (add: Set<number>, remove: Set<number>) => void;
}) {
  if (entries.length === 0) return null;
  const cycle = (id: number) => {
    const a = new Set(addIds);
    const r = new Set(removeSet);
    if (a.has(id)) { a.delete(id); r.add(id); }
    else if (r.has(id)) { r.delete(id); }
    else { a.add(id); }
    onChange(a, r);
  };
  return (
    <section>
      <p className="section-header mb-1">{title}</p>
      <p className="text-[10px] text-muted-foreground mb-2">Click once to add, twice to remove, third to clear</p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e) => {
          const isAdd = addIds.has(e.id);
          const isRemove = removeSet.has(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => cycle(e.id)}
              className={cn(
                'inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                isAdd ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400'
                  : isRemove ? 'bg-destructive/10 border-destructive/40 text-destructive'
                  : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30',
              )}
            >
              {isAdd && <span className="font-bold">+</span>}
              {isRemove && <span className="font-bold">−</span>}
              {e.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Visibility channel toggles behind an "apply" checkbox. */
function VisibilitySection({
  title = 'Visibility',
  apply,
  setApply,
  vis,
  setVis,
}: {
  title?: string;
  apply: boolean;
  setApply: (v: boolean) => void;
  vis: VisDraft;
  setVis: (updater: (v: VisDraft) => VisDraft) => void;
}) {
  return (
    <section>
      <label className="flex items-center gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} className="accent-primary cursor-pointer" />
        <span className="section-header">{title}</span>
      </label>
      {apply && (
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
  );
}

/** Price calculator row (mode select + value) behind an "apply" checkbox. */
function PriceCalcSection({
  title,
  apply,
  setApply,
  mode,
  setMode,
  value,
  setValue,
}: {
  title: string;
  apply: boolean;
  setApply: (v: boolean) => void;
  mode: PriceMode;
  setMode: (m: PriceMode) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <section>
      <label className="flex items-center gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} className="accent-primary cursor-pointer" />
        <span className="section-header">{title}</span>
      </label>
      {apply && (
        <div className="pl-5 flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as PriceMode)}
            className="input-field text-xs h-8"
          >
            {PRICE_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step={mode.includes('percent') ? 1 : 0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode.includes('percent') ? '10' : '0.00'}
            className="input-field w-24 text-xs h-8"
          />
        </div>
      )}
    </section>
  );
}

/** Three-way segmented control (No change / two values). */
function Segmented<T extends string>({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; tone?: 'green' | 'red' }[];
}) {
  return (
    <section>
      <p className="section-header mb-2">{title}</p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              value === opt.value
                ? opt.tone === 'red'
                  ? 'bg-destructive/10 border-destructive/40 text-destructive'
                  : opt.tone === 'green'
                    ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400'
                    : 'bg-muted border-border text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

// Levels deepest-first — the panel defaults to the deepest directly-checked level.
const LEVEL_PRIORITY: BulkLevel[] = ['option', 'modifier', 'item', 'category', 'menu'];
const LEVEL_LABEL: Record<BulkLevel, string> = {
  menu: 'Menus', category: 'Categories', item: 'Items', modifier: 'Modifiers', option: 'Options',
};

interface BulkEditPanelProps {
  selection: ReturnType<typeof useBulkSelection>;
  onClearSelection: () => void;
  /** Snapshot the store right before committing, so Undo can revert. */
  captureUndo: () => void;
}

export function BulkEditPanel({ selection, onClearSelection, captureUndo }: BulkEditPanelProps) {
  const { selected, selectedIdsAt, optionPairKeys } = selection;
  const {
    tags, allergens, stations, modifiers, modifierOptions,
    bulkUpdateMenus, bulkUpdateItems, bulkUpdateCategories, bulkUpdateModifiers,
    bulkUpdateModifierOptions, bulkUpdateOptionJoins, bulkAddModifiersToItems,
    bulkRemoveModifiersFromItems, bulkAddOptionsToModifiers, bulkRemoveOptionsFromModifiers,
  } = useMenuStore();

  const validTags = tags.filter((t) => t.id > 0 && t.name.trim().length > 0);
  const validAllergens = allergens.filter((a) => a.id > 0 && a.name.trim().length > 0);

  // Bulk edits apply to DIRECTLY-checked entities only (cascade is orientation,
  // not editing). One level is shown at a time, defaulting to the deepest checked.
  const menuIds = selectedIdsAt('menu');
  const categoryIds = selectedIdsAt('category');
  const itemIds = selectedIdsAt('item');
  const modifierIds = selectedIdsAt('modifier');
  const optionIds = selectedIdsAt('option');
  const countOf: Record<BulkLevel, number> = {
    menu: menuIds.length, category: categoryIds.length, item: itemIds.length,
    modifier: modifierIds.length, option: optionIds.length,
  };
  const presentLevels = LEVEL_PRIORITY.filter((l) => countOf[l] > 0);
  const presentKey = presentLevels.join(',');
  const deepest = presentLevels[0] ?? null; // LEVEL_PRIORITY is deepest-first

  const [activeLevel, setActiveLevel] = useState<BulkLevel | null>(deepest);
  const prevDeepest = useRef<BulkLevel | null>(deepest);
  useEffect(() => {
    if (!deepest) {
      setActiveLevel(null);
    } else if (deepest !== prevDeepest.current) {
      // The deepest checked level changed (e.g. you just checked items) → follow it.
      setActiveLevel(deepest);
    } else if (!activeLevel || !presentLevels.includes(activeLevel)) {
      // Current tab's level vanished → fall back to deepest.
      setActiveLevel(deepest);
    }
    prevDeepest.current = deepest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentKey]);

  // ---- Item drafts ----
  const [applyVisibility, setApplyVisibility] = useState(false);
  const [vis, setVis] = useState<VisDraft>(defaultVisDraft());
  const [applyPriceSection, setApplyPriceFlag] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode>('set');
  const [priceValue, setPriceValue] = useState('');
  const [stockAction, setStockAction] = useState<'none' | 'inStock' | 'outOfStock'>('none');
  const [tpoMode, setTpoMode] = useState<'none' | 'markup' | 'reset'>('none');
  const [tpoValue, setTpoValue] = useState('');
  const [applySaleCategory, setApplySaleCategory] = useState(false);
  const [saleCategoryValue, setSaleCategoryValue] = useState('Food Sales');
  const [applyQtyLimit, setApplyQtyLimit] = useState(false);
  const [qtyLimitValue, setQtyLimitValue] = useState('');
  const [tagAddIds, setTagAddIds] = useState<Set<number>>(new Set());
  const [tagRemoveIds, setTagRemoveIds] = useState<Set<number>>(new Set());
  const [allergenAddIds, setAllergenAddIds] = useState<Set<number>>(new Set());
  const [allergenRemoveIds, setAllergenRemoveIds] = useState<Set<number>>(new Set());
  const [stationAddIds, setStationAddIds] = useState<Set<number>>(new Set());
  const [stationRemoveIds, setStationRemoveIds] = useState<Set<number>>(new Set());
  const [modifierAddIds, setModifierAddIds] = useState<Set<number>>(new Set());
  const [modifierRemoveIds, setModifierRemoveIds] = useState<Set<number>>(new Set());

  // ---- Modifier (group) drafts ----
  const [modTypeAction, setModTypeAction] = useState<'none' | 'Optional' | 'Required' | 'Push Optional'>('none');
  const [minVal, setMinVal] = useState('');
  const [maxVal, setMaxVal] = useState('');
  const [optionAddIds, setOptionAddIds] = useState<Set<number>>(new Set());
  const [optionRemoveIds, setOptionRemoveIds] = useState<Set<number>>(new Set());

  // ---- Option drafts ----
  const [optStockAction, setOptStockAction] = useState<'none' | 'inStock' | 'outOfStock'>('none');
  const [applyOptPrice, setApplyOptPrice] = useState(false);
  const [optPriceMode, setOptPriceMode] = useState<PriceMode>('set');
  const [optPriceValue, setOptPriceValue] = useState('');
  const [applyOptVisibility, setApplyOptVisibility] = useState(false);
  const [optVis, setOptVis] = useState<VisDraft>(defaultVisDraft());

  // ---- Category drafts ----
  const [applyCatVisibility, setApplyCatVisibility] = useState(false);
  const [catVis, setCatVis] = useState<VisDraft>(defaultVisDraft());

  // ---- Menu drafts ----
  const [applyMenuVisibility, setApplyMenuVisibility] = useState(false);
  const [menuVis, setMenuVis] = useState<VisDraft>(defaultVisDraft());

  const [showReview, setShowReview] = useState(false);

  const resetDrafts = () => {
    setApplyVisibility(false); setVis(defaultVisDraft());
    setApplyPriceFlag(false); setPriceMode('set'); setPriceValue('');
    setStockAction('none');
    setTpoMode('none'); setTpoValue('');
    setApplySaleCategory(false); setSaleCategoryValue('Food Sales');
    setApplyQtyLimit(false); setQtyLimitValue('');
    setTagAddIds(new Set()); setTagRemoveIds(new Set());
    setAllergenAddIds(new Set()); setAllergenRemoveIds(new Set());
    setStationAddIds(new Set()); setStationRemoveIds(new Set());
    setModifierAddIds(new Set()); setModifierRemoveIds(new Set());
    setModTypeAction('none'); setMinVal(''); setMaxVal('');
    setOptionAddIds(new Set()); setOptionRemoveIds(new Set());
    setOptStockAction('none');
    setApplyOptPrice(false); setOptPriceMode('set'); setOptPriceValue('');
    setApplyOptVisibility(false); setOptVis(defaultVisDraft());
    setApplyCatVisibility(false); setCatVis(defaultVisDraft());
    setApplyMenuVisibility(false); setMenuVis(defaultVisDraft());
  };

  // ---- Staged operation summary for the ACTIVE level only ----
  const ops: BulkOp[] = [];
  if (activeLevel === 'item') {
    const t = (label: string) => ops.push({ scope: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}`, label, color: LEVEL_COLORS.item });
    if (applyVisibility) t('visibility channels');
    if (applyPriceSection && priceValue) t(`price ${priceModeLabel(priceMode)}${priceValue}`);
    if (stockAction !== 'none') t(`stock → ${stockAction === 'inStock' ? 'In Stock' : '86’ed'}`);
    if (tpoMode === 'markup' && tpoValue) t(`3PO prices → base +${tpoValue}%`);
    if (tpoMode === 'reset') t('3PO prices → reset to base');
    if (applySaleCategory && saleCategoryValue.trim()) t(`sale category → ${saleCategoryValue.trim()}`);
    if (applyQtyLimit && qtyLimitValue) t(`order qty limit → ${qtyLimitValue}`);
    if (tagAddIds.size) t(`+${tagAddIds.size} tag(s)`);
    if (tagRemoveIds.size) t(`−${tagRemoveIds.size} tag(s)`);
    if (allergenAddIds.size) t(`+${allergenAddIds.size} allergen(s)`);
    if (allergenRemoveIds.size) t(`−${allergenRemoveIds.size} allergen(s)`);
    if (stationAddIds.size) t(`+${stationAddIds.size} station(s)`);
    if (stationRemoveIds.size) t(`−${stationRemoveIds.size} station(s)`);
    if (modifierAddIds.size) t(`attach ${modifierAddIds.size} modifier(s)`);
    if (modifierRemoveIds.size) t(`detach ${modifierRemoveIds.size} modifier(s)`);
  } else if (activeLevel === 'modifier') {
    const t = (label: string) => ops.push({ scope: `${modifierIds.length} modifier${modifierIds.length !== 1 ? 's' : ''}`, label, color: LEVEL_COLORS.modifier });
    if (modTypeAction !== 'none') t(`type → ${modTypeAction}`);
    if (minVal !== '') t(`min selections → ${minVal}`);
    if (maxVal !== '') t(`max selections → ${maxVal}`);
    if (optionAddIds.size) t(`add ${optionAddIds.size} option(s)`);
    if (optionRemoveIds.size) t(`remove ${optionRemoveIds.size} option(s)`);
  } else if (activeLevel === 'option') {
    const t = (label: string) => ops.push({ scope: `${optionIds.length} option${optionIds.length !== 1 ? 's' : ''}`, label, color: LEVEL_COLORS.option });
    if (optStockAction !== 'none') t(`stock → ${optStockAction === 'inStock' ? 'In Stock' : '86’ed'}`);
    if (applyOptPrice && optPriceValue) t(`price ${priceModeLabel(optPriceMode)}${optPriceValue}`);
    if (applyOptVisibility) t('visibility channels');
  } else if (activeLevel === 'category' && applyCatVisibility) {
    ops.push({ scope: `${categoryIds.length} categor${categoryIds.length !== 1 ? 'ies' : 'y'}`, label: 'visibility channels', color: LEVEL_COLORS.category });
  } else if (activeLevel === 'menu' && applyMenuVisibility) {
    ops.push({ scope: `${menuIds.length} menu${menuIds.length !== 1 ? 's' : ''}`, label: 'visibility channels', color: LEVEL_COLORS.menu });
  }

  // ---- Warnings shown in the review modal (active = modifier only) ----
  const warnings: string[] = [];
  if (activeLevel === 'modifier' && (optionRemoveIds.size || modTypeAction === 'Required')) {
    for (const modId of modifierIds) {
      const mod = modifiers.find((m) => m.id === modId);
      if (!mod) continue;
      const effectiveType = modTypeAction !== 'none' ? modTypeAction : mod.modType;
      if (effectiveType !== 'Required') continue;
      const after = new Set(
        selection.data.modifierModifierOptions
          .filter((mmo) => mmo.modifierId === modId)
          .map((mmo) => mmo.modifierOptionId)
          .filter((id) => !optionRemoveIds.has(id)),
      );
      optionAddIds.forEach((id) => after.add(id));
      if (after.size === 0) warnings.push(`"${mod.modifierName}" is required but would have no options`);
    }
  }
  if (activeLevel === 'modifier' && minVal !== '' && maxVal !== '' && +minVal > +maxVal) {
    warnings.push('Min selections exceeds max');
  }

  const handleConfirm = () => {
    captureUndo();

    if (activeLevel === 'item') {
      const numericPrice = parseFloat(priceValue);
      const tpoPct = parseFloat(tpoValue);
      const hasItemFieldEdits =
        applyVisibility || (applyPriceSection && priceValue) || stockAction !== 'none' ||
        tpoMode !== 'none' || (applySaleCategory && saleCategoryValue.trim()) ||
        (applyQtyLimit && qtyLimitValue) ||
        tagAddIds.size || tagRemoveIds.size || allergenAddIds.size || allergenRemoveIds.size ||
        stationAddIds.size || stationRemoveIds.size;

      if (hasItemFieldEdits) {
        bulkUpdateItems(itemIds, (item: Item): Partial<Item> => {
          const updates: Partial<Item> = {};
          if (applyVisibility) Object.assign(updates, vis);
          if (applyPriceSection && priceValue && !isNaN(numericPrice)) {
            updates.itemPrice = applyPriceCalc(item.itemPrice, priceMode, numericPrice);
          }
          if (stockAction !== 'none') updates.stockStatus = stockAction;
          if (tpoMode === 'markup' && !isNaN(tpoPct)) {
            const base = applyPriceSection && priceValue && !isNaN(numericPrice)
              ? applyPriceCalc(item.itemPrice, priceMode, numericPrice)
              : item.itemPrice;
            const marked = Math.round(base * (1 + tpoPct / 100) * 100) / 100;
            updates.doordashPrice = marked;
            updates.uberEatsPrice = marked;
            updates.grubHubPrice = marked;
          }
          if (tpoMode === 'reset') {
            updates.doordashPrice = 0;
            updates.uberEatsPrice = 0;
            updates.grubHubPrice = 0;
          }
          if (applySaleCategory && saleCategoryValue.trim()) updates.saleCategory = saleCategoryValue.trim();
          if (applyQtyLimit && qtyLimitValue) {
            updates.orderQuantityLimit = true;
            updates.maxLimit = parseInt(qtyLimitValue, 10);
            updates.noMaxLimit = false;
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
      }
      if (modifierAddIds.size) bulkAddModifiersToItems(itemIds, [...modifierAddIds]);
      if (modifierRemoveIds.size) bulkRemoveModifiersFromItems(itemIds, [...modifierRemoveIds]);
    }

    if (activeLevel === 'modifier') {
      if (modTypeAction !== 'none' || minVal !== '' || maxVal !== '') {
        bulkUpdateModifiers(modifierIds, (): Partial<Modifier> => {
          const updates: Partial<Modifier> = {};
          if (modTypeAction !== 'none') updates.modType = modTypeAction;
          if (minVal !== '') updates.minSelector = parseInt(minVal, 10);
          if (maxVal !== '') {
            updates.maxSelector = parseInt(maxVal, 10);
            updates.noMaxSelection = false;
          }
          return updates;
        });
      }
      if (optionAddIds.size) bulkAddOptionsToModifiers(modifierIds, [...optionAddIds]);
      if (optionRemoveIds.size) bulkRemoveOptionsFromModifiers(modifierIds, [...optionRemoveIds]);
    }

    if (activeLevel === 'option') {
      const numericOptPrice = parseFloat(optPriceValue);
      if (optStockAction !== 'none' || applyOptVisibility || (applyOptPrice && optPriceValue)) {
        bulkUpdateModifierOptions(optionIds, (opt: ModifierOption): Partial<ModifierOption> => {
          const updates: Partial<ModifierOption> = {};
          if (optStockAction !== 'none') updates.isStockAvailable = optStockAction === 'inStock';
          if (applyOptVisibility) Object.assign(updates, optVis);
          if (applyOptPrice && optPriceValue && !isNaN(numericOptPrice)) {
            updates.price = applyPriceCalc(opt.price ?? 0, optPriceMode, numericOptPrice);
          }
          return updates;
        });
      }
      // Surcharge lives on the join (maxLimit) — keep it in sync for the selected options
      if (applyOptPrice && optPriceValue && !isNaN(numericOptPrice)) {
        bulkUpdateOptionJoins(optionPairKeys(optionIds), (mmo) => ({
          maxLimit: applyPriceCalc(mmo.maxLimit ?? 0, optPriceMode, numericOptPrice),
        }));
      }
    }

    if (activeLevel === 'category' && applyCatVisibility) {
      bulkUpdateCategories(categoryIds, () => ({ ...catVis }));
    }

    if (activeLevel === 'menu' && applyMenuVisibility) {
      bulkUpdateMenus(menuIds, () => ({ ...menuVis }));
    }

    toast.success(`Applied ${ops.length} change${ops.length !== 1 ? 's' : ''} to ${countOf[activeLevel!]} ${LEVEL_LABEL[activeLevel!].toLowerCase()}`);
    resetDrafts();
    setShowReview(false);
  };

  const handleApplyClick = () => {
    if (minVal !== '' && maxVal !== '' && +minVal > +maxVal) {
      toast.error('Min selections cannot exceed max');
      return;
    }
    setShowReview(true);
  };

  const activeCount = activeLevel ? countOf[activeLevel] : 0;
  const reachSummary = activeLevel
    ? `${activeCount} ${LEVEL_LABEL[activeLevel].toLowerCase()}`
    : '';

  if (!activeLevel) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-6 text-center">
        Check entities in the columns to bulk-edit them
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Editing {activeCount} {LEVEL_LABEL[activeLevel].toLowerCase()}
          </h2>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
        {/* Level switcher — only when more than one level is directly checked */}
        {presentLevels.length > 1 && (
          <div className="mt-2 flex gap-1 rounded-lg bg-muted p-0.5">
            {LEVEL_PRIORITY.slice().reverse().filter((l) => countOf[l] > 0).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setActiveLevel(l)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-colors',
                  activeLevel === l
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: LEVEL_COLORS[l] }} />
                {LEVEL_LABEL[l]} {countOf[l]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 space-y-5">

          {activeLevel === 'item' && (
            <>
              <Segmented<'none' | 'inStock' | 'outOfStock'>
                title="Stock status"
                value={stockAction}
                onChange={setStockAction}
                options={[
                  { value: 'none', label: 'No change' },
                  { value: 'inStock', label: 'In Stock', tone: 'green' },
                  { value: 'outOfStock', label: '86’ed', tone: 'red' },
                ]}
              />

              <PriceCalcSection
                title="Price"
                apply={applyPriceSection}
                setApply={setApplyPriceFlag}
                mode={priceMode}
                setMode={setPriceMode}
                value={priceValue}
                setValue={setPriceValue}
              />

              {/* 3PO delivery prices */}
              <section>
                <p className="section-header mb-1">3PO delivery prices</p>
                <p className="text-[10px] text-muted-foreground mb-2">DoorDash, UberEats &amp; GrubHub prices from a markup over base</p>
                <div className="flex items-center gap-2">
                  <select
                    value={tpoMode}
                    onChange={(e) => setTpoMode(e.target.value as typeof tpoMode)}
                    className="input-field text-xs h-8 flex-1"
                  >
                    <option value="none">No change</option>
                    <option value="markup">Markup % over base</option>
                    <option value="reset">Reset to base price</option>
                  </select>
                  {tpoMode === 'markup' && (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={tpoValue}
                      onChange={(e) => setTpoValue(e.target.value)}
                      placeholder="15"
                      className="input-field w-20 text-xs h-8"
                    />
                  )}
                </div>
              </section>

              <VisibilitySection apply={applyVisibility} setApply={setApplyVisibility} vis={vis} setVis={setVis} />

              <ChipPicker
                title="Tags"
                entries={validTags.map((t) => ({ id: t.id, label: t.name }))}
                addIds={tagAddIds}
                removeIds={tagRemoveIds}
                onChange={(a, r) => { setTagAddIds(a); setTagRemoveIds(r); }}
              />
              <ChipPicker
                title="Allergens"
                entries={validAllergens.map((a) => ({ id: a.id, label: a.name }))}
                addIds={allergenAddIds}
                removeIds={allergenRemoveIds}
                onChange={(a, r) => { setAllergenAddIds(a); setAllergenRemoveIds(r); }}
              />
              <ChipPicker
                title="Stations"
                entries={stations.map((s) => ({ id: s.id, label: s.label || `Station ${s.id}` }))}
                addIds={stationAddIds}
                removeIds={stationRemoveIds}
                onChange={(a, r) => { setStationAddIds(a); setStationRemoveIds(r); }}
              />
              <ChipPicker
                title="Attached modifiers"
                entries={modifiers.filter((m) => m.modifierName.trim()).map((m) => ({ id: m.id, label: m.modifierName }))}
                addIds={modifierAddIds}
                removeIds={modifierRemoveIds}
                onChange={(a, r) => { setModifierAddIds(a); setModifierRemoveIds(r); }}
              />

              {/* Sale category */}
              <section>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={applySaleCategory} onChange={(e) => setApplySaleCategory(e.target.checked)} className="accent-primary cursor-pointer" />
                  <span className="section-header">Sale category</span>
                </label>
                {applySaleCategory && (
                  <div className="pl-5">
                    <SaleCategorySelect
                      value={saleCategoryValue}
                      onChange={setSaleCategoryValue}
                      triggerClassName="text-xs h-8"
                    />
                  </div>
                )}
              </section>

              {/* Order qty limit */}
              <section>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={applyQtyLimit} onChange={(e) => setApplyQtyLimit(e.target.checked)} className="accent-primary cursor-pointer" />
                  <span className="section-header">Order qty limit</span>
                </label>
                {applyQtyLimit && (
                  <div className="pl-5">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={qtyLimitValue}
                      onChange={(e) => setQtyLimitValue(e.target.value)}
                      placeholder="Max per order"
                      className="input-field w-full text-xs h-8"
                    />
                  </div>
                )}
              </section>
            </>
          )}

          {activeLevel === 'modifier' && (
            <>
              <Segmented<'none' | 'Optional' | 'Required' | 'Push Optional'>
                title="Requirement"
                value={modTypeAction}
                onChange={setModTypeAction}
                options={[
                  { value: 'none', label: 'No change' },
                  { value: 'Required', label: 'Required', tone: 'green' },
                  { value: 'Optional', label: 'Optional' },
                ]}
              />

              <section>
                <p className="section-header mb-2">Min / max selections</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={minVal}
                    onChange={(e) => setMinVal(e.target.value)}
                    placeholder="Min — no change"
                    className="input-field flex-1 text-xs h-8"
                  />
                  <input
                    type="number"
                    min={0}
                    value={maxVal}
                    onChange={(e) => setMaxVal(e.target.value)}
                    placeholder="Max — no change"
                    className="input-field flex-1 text-xs h-8"
                  />
                </div>
              </section>

              <ChipPicker
                title="Options in these modifiers"
                entries={modifierOptions.filter((o) => o.optionName.trim()).map((o) => ({ id: o.id, label: o.optionName }))}
                addIds={optionAddIds}
                removeIds={optionRemoveIds}
                onChange={(a, r) => { setOptionAddIds(a); setOptionRemoveIds(r); }}
              />
            </>
          )}

          {activeLevel === 'option' && (
            <>
              <Segmented<'none' | 'inStock' | 'outOfStock'>
                title="Stock status"
                value={optStockAction}
                onChange={setOptStockAction}
                options={[
                  { value: 'none', label: 'No change' },
                  { value: 'inStock', label: 'In Stock', tone: 'green' },
                  { value: 'outOfStock', label: '86’ed', tone: 'red' },
                ]}
              />

              <PriceCalcSection
                title="Surcharge price"
                apply={applyOptPrice}
                setApply={setApplyOptPrice}
                mode={optPriceMode}
                setMode={setOptPriceMode}
                value={optPriceValue}
                setValue={setOptPriceValue}
              />

              <VisibilitySection
                apply={applyOptVisibility}
                setApply={setApplyOptVisibility}
                vis={optVis}
                setVis={setOptVis}
              />
            </>
          )}

          {activeLevel === 'category' && (
            <VisibilitySection
              apply={applyCatVisibility}
              setApply={setApplyCatVisibility}
              vis={catVis}
              setVis={setCatVis}
            />
          )}

          {activeLevel === 'menu' && (
            <VisibilitySection
              apply={applyMenuVisibility}
              setApply={setApplyMenuVisibility}
              vis={menuVis}
              setVis={setMenuVis}
            />
          )}
        </div>
      </div>

      {/* Apply button */}
      <div className="shrink-0 px-4 py-3 border-t border-border space-y-2">
        {ops.length > 0 && (
          <p className="text-[10px] text-muted-foreground leading-snug">
            {ops.length} staged change{ops.length !== 1 ? 's' : ''} — review before applying
          </p>
        )}
        <button
          type="button"
          onClick={handleApplyClick}
          disabled={ops.length === 0}
          className={cn(
            'w-full py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
            ops.length > 0
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          <Check className="w-3.5 h-3.5" />
          Review &amp; apply
        </button>
      </div>

      <BulkReviewModal
        open={showReview}
        onOpenChange={setShowReview}
        ops={ops}
        reachSummary={reachSummary}
        warnings={warnings}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
