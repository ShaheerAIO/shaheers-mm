import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { toggleVisibilityChannel } from '@/lib/visibility';
import type { Category, Item, Modifier, ModifierOption } from '@/types/menu';
import { BulkReviewModal, type BulkOp } from './BulkReviewModal';
import { CategoryImageLibraryModal } from './CategoryImageLibraryModal';
import { LoadingImage } from '@/components/ui/loading-image';
import { LEVEL_COLORS, type BulkLevel, type useBulkSelection } from './useBulkSelection';
import { SaleCategorySelect } from '@/components/menu-builder/SaleCategorySelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const VIS_CHANNELS = [
  { key: 'visibilityPos' as const, label: 'POS' },
  { key: 'visibilityKiosk' as const, label: 'Kiosk' },
  { key: 'visibilityMenuBoard' as const, label: 'Menu Board' },
  { key: 'visibilityMobileApp' as const, label: 'MPOS' },
  { key: 'visibilityNugget' as const, label: 'Nugget' },
  { key: 'visibilityQr' as const, label: 'QR' },
  { key: 'visibilityWebsite' as const, label: 'Website' },
  { key: 'visibilityOnline' as const, label: 'Online' },
  { key: 'visibilityDoordash' as const, label: 'DoorDash' },
];

type VisDraft = Record<(typeof VIS_CHANNELS)[number]['key'], boolean>;
const defaultVisDraft = (): VisDraft => ({
  visibilityPos: true,
  visibilityKiosk: true,
  visibilityMenuBoard: true,
  visibilityMobileApp: true,
  visibilityNugget: true,
  visibilityQr: true,
  visibilityWebsite: true,
  visibilityOnline: true,
  visibilityDoordash: true,
});

// Items expose two image *dimensions* — a 1:1 image that seeds every
// square/platform field, and a single 16:9 landscape field. Bulk-editing
// mirrors this: uploading a 1:1 image only touches the square fields, and
// uploading a 16:9 image only touches the landscape field.
const ITEM_SQUARE_FIELDS = ['itemPicture', 'kioskItemImage', 'onlineImage', 'thirdPartyImage'] as const;

const CAT_IMAGE_SLOTS = [
  { field: 'image' as const, label: 'POS / MPOS' },
  { field: 'kioskImage' as const, label: 'Kiosk' },
];
type CatImageField = (typeof CAT_IMAGE_SLOTS)[number]['field'];
const emptyCatSlots = (): Record<CatImageField, string> => ({ image: '', kioskImage: '' });

type ImageMode = 'all' | 'perSlot';

/** A single choose/preview/clear image control, reused across bulk image editors. */
function SingleImagePicker({
  url,
  onChoose,
  onClear,
}: {
  url: string;
  onChoose: () => void;
  onClear: () => void;
}) {
  return url ? (
    <div className="flex items-center gap-2">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-border">
        <LoadingImage src={url} alt="Selected" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-col gap-1">
        <button type="button" onClick={onChoose} className="text-xs text-primary hover:underline text-left">Change image</button>
        <button type="button" onClick={onClear} className="text-xs text-destructive hover:underline text-left">Clear</button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={onChoose}
      className="input-field w-full text-xs h-8 flex items-center justify-center gap-1.5 hover:border-primary/40"
    >
      <Upload className="w-3.5 h-3.5" /> Choose image
    </button>
  );
}

/**
 * Bulk image editor for items: two independent, dimension-based uploads.
 * A 1:1 image seeds every square/platform field (POS, MPOS, Online, QR,
 * Kiosk, 3rd Party); a 16:9 image only sets the landscape field. Each is
 * optional and independent — uploading one never touches the other.
 */
function ItemBulkImageEditor({
  squareUrl,
  onChooseSquare,
  onClearSquare,
  landscapeUrl,
  onChooseLandscape,
  onClearLandscape,
}: {
  squareUrl: string;
  onChooseSquare: () => void;
  onClearSquare: () => void;
  landscapeUrl: string;
  onChooseLandscape: () => void;
  onClearLandscape: () => void;
}) {
  return (
    <div className="pl-5 space-y-3">
      <div>
        <p className="text-xs font-medium mb-1">Image 1:1</p>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          Applies to POS, MPOS, Online, QR &amp; Kiosk for the selected items.
        </p>
        <SingleImagePicker url={squareUrl} onChoose={onChooseSquare} onClear={onClearSquare} />
      </div>
      <div>
        <p className="text-xs font-medium mb-1">Image 16:9</p>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          Applies to the landscape image for the selected items.
        </p>
        <SingleImagePicker url={landscapeUrl} onChoose={onChooseLandscape} onClear={onClearLandscape} />
      </div>
    </div>
  );
}

/** Bulk image editor: "one image for all slots" or a per-slot grid. */
function BulkImageEditor<F extends string>({
  mode, setMode, entityLabel,
  allUrl, onChooseAll, onClearAll,
  slots, slotValues, onChooseSlot, onClearSlot,
}: {
  mode: ImageMode;
  setMode: (m: ImageMode) => void;
  entityLabel: string;
  allUrl: string;
  onChooseAll: () => void;
  onClearAll: () => void;
  slots: { field: F; label: string }[];
  slotValues: Record<F, string>;
  onChooseSlot: (field: F) => void;
  onClearSlot: (field: F) => void;
}) {
  return (
    <div className="pl-5 space-y-2">
      <div className="flex gap-1.5">
        {(['all', 'perSlot'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
              mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50',
            )}
          >
            {m === 'all' ? 'One for all slots' : 'Per slot'}
          </button>
        ))}
      </div>
      {mode === 'all' ? (
        <>
          <p className="text-[10px] text-muted-foreground">Applies one image to every slot on the selected {entityLabel}.</p>
          <SingleImagePicker url={allUrl} onChoose={onChooseAll} onClear={onClearAll} />
        </>
      ) : (
        <>
          <p className="text-[10px] text-muted-foreground">Set an image per slot. Slots left blank are not changed on the selected {entityLabel}.</p>
          <div className="grid grid-cols-2 gap-2">
            {slots.map(({ field, label }) => {
              const url = slotValues[field];
              return (
                <div key={field} className="overflow-hidden rounded-lg border border-border bg-muted/20">
                  <div className="relative aspect-square bg-muted/40">
                    {url ? (
                      <LoadingImage src={url} alt={label} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">No image</div>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1 py-0.5 text-[9px] font-semibold shadow-sm">{label}</span>
                    {url && (
                      <button
                        type="button"
                        aria-label={`Clear ${label}`}
                        onClick={() => onClearSlot(field)}
                        className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onChooseSlot(field)}
                    className="inline-flex w-full items-center justify-center gap-1 border-t border-border py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Upload className="h-3 w-3" /> {url ? 'Replace' : 'Upload'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

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

/**
 * Tri-state chip row. Chips are annotated with how many of the selected
 * targets already have each entry (`coverage`), so operators can see existing
 * assignments and deselect them:
 *   - attached to ALL targets → check + "attached" tint; click stages removal.
 *   - attached to SOME (mixed) → "N/total" badge; click cycles add → remove.
 *   - attached to NONE → plain; click stages an add.
 */
function ChipPicker({
  title,
  entries,
  addIds,
  removeIds: removeSet,
  onChange,
  coverage,
  total = 0,
}: {
  title: string;
  entries: { id: number; label: string }[];
  addIds: Set<number>;
  removeIds: Set<number>;
  onChange: (add: Set<number>, remove: Set<number>) => void;
  /** entry id → number of selected targets that already have it. */
  coverage?: Map<number, number>;
  /** number of selected targets (denominator for coverage). */
  total?: number;
}) {
  if (entries.length === 0) return null;
  const stateOf = (id: number): 'all' | 'some' | 'none' => {
    const have = coverage?.get(id) ?? 0;
    if (have <= 0) return 'none';
    return total > 0 && have >= total ? 'all' : 'some';
  };
  const cycle = (id: number) => {
    const st = stateOf(id);
    const a = new Set(addIds);
    const r = new Set(removeSet);
    if (a.has(id)) {
      // leaving "add"; offer removal next only where something exists to remove
      a.delete(id);
      if (st !== 'none') r.add(id);
    } else if (r.has(id)) {
      r.delete(id);
    } else if (st === 'all') {
      r.add(id); // fully attached → the only meaningful action is removal
    } else {
      a.add(id);
    }
    onChange(a, r);
  };
  const anyCoverage = entries.some((e) => (coverage?.get(e.id) ?? 0) > 0);
  return (
    <section>
      <p className="section-header mb-1">{title}</p>
      <p className="text-[10px] text-muted-foreground mb-2">
        {anyCoverage
          ? 'Checked = already attached. Click to add, remove, or clear.'
          : 'Click once to add, twice to remove, third to clear'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e) => {
          const isAdd = addIds.has(e.id);
          const isRemove = removeSet.has(e.id);
          const have = coverage?.get(e.id) ?? 0;
          const st = stateOf(e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => cycle(e.id)}
              className={cn(
                'inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                isAdd ? 'bg-green-500/10 border-green-500/40 text-green-600 dark:text-green-400'
                  : isRemove ? 'bg-destructive/10 border-destructive/40 text-destructive'
                  : st === 'all' ? 'bg-primary/10 border-primary/40 text-primary'
                  : st === 'some' ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30',
              )}
            >
              {isAdd && <span className="font-bold">+</span>}
              {isRemove && <span className="font-bold">−</span>}
              {!isAdd && !isRemove && st === 'all' && <Check className="w-3 h-3" />}
              {e.label}
              {!isAdd && !isRemove && st === 'some' && (
                <span className="opacity-70 tabular-nums">{have}/{total}</span>
              )}
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
                onClick={() => setVis((v) => toggleVisibilityChannel(v, ch.key))}
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

/** Tax selector (No change / No tax / Standard rate / each custom tax). */
function TaxSection({
  value,
  onChange,
  customTaxes,
  taxRate,
}: {
  value: string;
  onChange: (v: string) => void;
  customTaxes: { id: number; name: string; rate: number }[];
  taxRate: number;
}) {
  return (
    <section>
      <p className="section-header mb-2">Tax</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="text-xs h-8">
          <SelectValue placeholder="No change" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No change</SelectItem>
          <SelectItem value="noTax">No tax</SelectItem>
          <SelectItem value="standard">Standard rate · {taxRate}%</SelectItem>
          {customTaxes.map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>{t.name} · {t.rate}%</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
    tags, allergens, stations, modifiers, modifierOptions, customTaxes, taxRate,
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

  // ---- Current assignment coverage across the DIRECTLY-checked targets ----
  // Each map is entry-id → how many selected targets already have it, so the
  // chip pickers can surface existing assignments for review/removal.
  const { itemModifiers, modifierModifierOptions, items } = selection.data;
  const itemIdsKey = itemIds.join(',');
  const modifierIdsKey = modifierIds.join(',');
  const countByCsv = (field: 'stationIds' | 'tagIds' | 'allergenIds'): Map<number, number> => {
    const m = new Map<number, number>();
    const wanted = new Set(itemIds);
    for (const it of items) {
      if (!wanted.has(it.id)) continue;
      for (const id of parseIdsCsv(it[field])) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stationCoverage = useMemo(() => countByCsv('stationIds'), [itemIdsKey, items]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tagCoverage = useMemo(() => countByCsv('tagIds'), [itemIdsKey, items]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allergenCoverage = useMemo(() => countByCsv('allergenIds'), [itemIdsKey, items]);
  const modifierCoverage = useMemo(() => {
    const m = new Map<number, number>();
    const wanted = new Set(itemIds);
    for (const im of itemModifiers) {
      if (wanted.has(im.itemId)) m.set(im.modifierId, (m.get(im.modifierId) ?? 0) + 1);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIdsKey, itemModifiers]);
  const optionCoverage = useMemo(() => {
    const m = new Map<number, number>();
    const wanted = new Set(modifierIds);
    for (const mmo of modifierModifierOptions) {
      if (wanted.has(mmo.modifierId)) m.set(mmo.modifierOptionId, (m.get(mmo.modifierOptionId) ?? 0) + 1);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifierIdsKey, modifierModifierOptions]);

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
  const [inheritVisAction, setInheritVisAction] = useState<'none' | 'on' | 'off'>('none');
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
  const [qtyLimitNoMax, setQtyLimitNoMax] = useState(false);
  const [applyImage, setApplyImage] = useState(false);
  const [bulkSquareImageUrl, setBulkSquareImageUrl] = useState('');
  const [bulkLandscapeImageUrl, setBulkLandscapeImageUrl] = useState('');
  const [imageModalTarget, setImageModalTarget] = useState<'square' | 'landscape' | null>(null);
  const [taxAction, setTaxAction] = useState<string>('none'); // 'none' | 'noTax' | 'standard' | String(tax.id)
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
  const [applyCatImage, setApplyCatImage] = useState(false);
  const [catImageMode, setCatImageMode] = useState<ImageMode>('all');
  const [bulkCatImageUrl, setBulkCatImageUrl] = useState('');
  const [catSlotImages, setCatSlotImages] = useState<Record<CatImageField, string>>(emptyCatSlots());
  const [catImageModalTarget, setCatImageModalTarget] = useState<'all' | CatImageField | null>(null);

  // ---- Menu drafts ----
  const [applyMenuVisibility, setApplyMenuVisibility] = useState(false);
  const [menuVis, setMenuVis] = useState<VisDraft>(defaultVisDraft());

  const [showReview, setShowReview] = useState(false);

  // Turn the tax selection into an Item patch. 'none' → no patch (returns {}).
  const taxPatch = (): Partial<Item> => {
    if (taxAction === 'noTax') return { salesTax: false };
    if (taxAction === 'standard') return { salesTax: true, customTaxId: undefined };
    const id = parseInt(taxAction, 10);
    if (!isNaN(id)) return { salesTax: true, customTaxId: id };
    return {};
  };
  const taxActionLabel = (): string => {
    if (taxAction === 'noTax') return 'No tax';
    if (taxAction === 'standard') return 'Standard rate';
    const tax = customTaxes.find((t) => String(t.id) === taxAction);
    return tax ? `${tax.name} · ${tax.rate}%` : '';
  };

  const resetDrafts = () => {
    setApplyVisibility(false); setVis(defaultVisDraft());
    setInheritVisAction('none');
    setApplyPriceFlag(false); setPriceMode('set'); setPriceValue('');
    setStockAction('none');
    setTpoMode('none'); setTpoValue('');
    setApplySaleCategory(false); setSaleCategoryValue('Food Sales');
    setApplyQtyLimit(false); setQtyLimitValue(''); setQtyLimitNoMax(false);
    setApplyImage(false); setBulkSquareImageUrl(''); setBulkLandscapeImageUrl('');
    setTaxAction('none');
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
    setApplyCatImage(false); setCatImageMode('all'); setBulkCatImageUrl(''); setCatSlotImages(emptyCatSlots());
    setApplyMenuVisibility(false); setMenuVis(defaultVisDraft());
  };

  // ---- Staged operation summary for the ACTIVE level only ----
  const ops: BulkOp[] = [];
  if (activeLevel === 'item') {
    const t = (label: string) => ops.push({ scope: `${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}`, label, color: LEVEL_COLORS.item });
    if (applyVisibility) t('visibility channels');
    if (inheritVisAction !== 'none') t(`visibility → ${inheritVisAction === 'on' ? 'inherit from category' : 'override'}`);
    if (applyPriceSection && priceValue) t(`price ${priceModeLabel(priceMode)}${priceValue}`);
    if (stockAction !== 'none') t(`stock → ${stockAction === 'inStock' ? 'In Stock' : '86’ed'}`);
    if (tpoMode === 'markup' && tpoValue) t(`3PO prices → base +${tpoValue}%`);
    if (tpoMode === 'reset') t('3PO prices → reset to base');
    if (applySaleCategory && saleCategoryValue.trim()) t(`sale category → ${saleCategoryValue.trim()}`);
    if (applyQtyLimit) {
      if (qtyLimitNoMax) t('order qty limit → no maximum');
      else if (qtyLimitValue) t(`order qty limit → ${qtyLimitValue}`);
    }
    if (applyImage) {
      if (bulkSquareImageUrl) t('set 1:1 image');
      if (bulkLandscapeImageUrl) t('set 16:9 image');
    }
    if (taxAction !== 'none') t(`tax → ${taxActionLabel()}`);
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
  } else if (activeLevel === 'category') {
    const scope = `${categoryIds.length} categor${categoryIds.length !== 1 ? 'ies' : 'y'}`;
    if (applyCatVisibility) ops.push({ scope, label: 'visibility channels', color: LEVEL_COLORS.category });
    if (applyCatImage) {
      if (catImageMode === 'all' && bulkCatImageUrl) ops.push({ scope, label: 'set category image (all slots)', color: LEVEL_COLORS.category });
      else if (catImageMode === 'perSlot') {
        const n = Object.values(catSlotImages).filter(Boolean).length;
        if (n) ops.push({ scope, label: `set ${n} category image slot${n !== 1 ? 's' : ''}`, color: LEVEL_COLORS.category });
      }
    }
    if (taxAction !== 'none') ops.push({ scope: `items in ${scope}`, label: `tax → ${taxActionLabel()}`, color: LEVEL_COLORS.category });
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
        applyVisibility || inheritVisAction !== 'none' || (applyPriceSection && priceValue) || stockAction !== 'none' ||
        tpoMode !== 'none' || (applySaleCategory && saleCategoryValue.trim()) ||
        (applyQtyLimit && (qtyLimitValue || qtyLimitNoMax)) ||
        (applyImage && (!!bulkSquareImageUrl || !!bulkLandscapeImageUrl)) ||
        taxAction !== 'none' ||
        tagAddIds.size || tagRemoveIds.size || allergenAddIds.size || allergenRemoveIds.size ||
        stationAddIds.size || stationRemoveIds.size;

      if (hasItemFieldEdits) {
        bulkUpdateItems(itemIds, (item: Item): Partial<Item> => {
          const updates: Partial<Item> = {};
          if (applyVisibility) Object.assign(updates, vis);
          if (inheritVisAction !== 'none') updates.inheritVisibilityFromCategory = inheritVisAction === 'on';
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
          if (applyQtyLimit) {
            if (qtyLimitNoMax) {
              updates.orderQuantityLimit = true;
              updates.noMaxLimit = true;
            } else if (qtyLimitValue) {
              updates.orderQuantityLimit = true;
              updates.maxLimit = parseInt(qtyLimitValue, 10);
              updates.noMaxLimit = false;
            }
          }
          if (applyImage) {
            // 1:1 and 16:9 are independent — setting one never touches the other.
            if (bulkSquareImageUrl) {
              for (const field of ITEM_SQUARE_FIELDS) updates[field] = bulkSquareImageUrl;
            }
            if (bulkLandscapeImageUrl) {
              updates.landscapeImage = bulkLandscapeImageUrl;
            }
          }
          if (taxAction !== 'none') Object.assign(updates, taxPatch());
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

    if (activeLevel === 'category') {
      if (applyCatVisibility) {
        bulkUpdateCategories(categoryIds, () => ({ ...catVis }));
      }
      if (applyCatImage) {
        if (catImageMode === 'all' && bulkCatImageUrl) {
          // One image seeds both POS and Kiosk slots (mirrors the single-category panel).
          bulkUpdateCategories(categoryIds, () => ({ image: bulkCatImageUrl, kioskImage: bulkCatImageUrl }));
        } else if (catImageMode === 'perSlot') {
          const patch: Partial<Category> = {};
          for (const { field } of CAT_IMAGE_SLOTS) {
            if (catSlotImages[field]) patch[field] = catSlotImages[field];
          }
          if (Object.keys(patch).length) bulkUpdateCategories(categoryIds, () => patch);
        }
      }
      if (taxAction !== 'none') {
        const catIdSet = new Set(categoryIds);
        const targetItemIds = [
          ...new Set(
            selection.data.categoryItems
              .filter((ci) => catIdSet.has(ci.categoryId))
              .map((ci) => ci.itemId),
          ),
        ];
        if (targetItemIds.length) bulkUpdateItems(targetItemIds, () => taxPatch());
      }
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

              <Segmented<'none' | 'on' | 'off'>
                title="Visibility source"
                value={inheritVisAction}
                onChange={setInheritVisAction}
                options={[
                  { value: 'none', label: 'No change' },
                  { value: 'on', label: 'Inherit from category' },
                  { value: 'off', label: 'Override' },
                ]}
              />

              <ChipPicker
                title="Tags"
                entries={validTags.map((t) => ({ id: t.id, label: t.name }))}
                addIds={tagAddIds}
                removeIds={tagRemoveIds}
                onChange={(a, r) => { setTagAddIds(a); setTagRemoveIds(r); }}
                coverage={tagCoverage}
                total={itemIds.length}
              />
              <ChipPicker
                title="Allergens"
                entries={validAllergens.map((a) => ({ id: a.id, label: a.name }))}
                addIds={allergenAddIds}
                removeIds={allergenRemoveIds}
                onChange={(a, r) => { setAllergenAddIds(a); setAllergenRemoveIds(r); }}
                coverage={allergenCoverage}
                total={itemIds.length}
              />
              <ChipPicker
                title="Stations"
                entries={stations.map((s) => ({ id: s.id, label: s.label || `Station ${s.id}` }))}
                addIds={stationAddIds}
                removeIds={stationRemoveIds}
                onChange={(a, r) => { setStationAddIds(a); setStationRemoveIds(r); }}
                coverage={stationCoverage}
                total={itemIds.length}
              />
              <ChipPicker
                title="Attached modifiers"
                entries={modifiers.filter((m) => m.modifierName.trim()).map((m) => ({ id: m.id, label: m.modifierName }))}
                addIds={modifierAddIds}
                removeIds={modifierRemoveIds}
                onChange={(a, r) => { setModifierAddIds(a); setModifierRemoveIds(r); }}
                coverage={modifierCoverage}
                total={itemIds.length}
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
                  <div className="pl-5 space-y-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={qtyLimitValue}
                      onChange={(e) => setQtyLimitValue(e.target.value)}
                      placeholder="Max per order"
                      disabled={qtyLimitNoMax}
                      className="input-field w-full text-xs h-8 disabled:opacity-50"
                    />
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={qtyLimitNoMax} onChange={(e) => setQtyLimitNoMax(e.target.checked)} className="accent-primary cursor-pointer" />
                      <span className="text-xs text-muted-foreground">No maximum (unlimited quantity per order)</span>
                    </label>
                  </div>
                )}
              </section>

              {/* Image */}
              <section>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={applyImage} onChange={(e) => setApplyImage(e.target.checked)} className="accent-primary cursor-pointer" />
                  <span className="section-header">Image</span>
                </label>
                {applyImage && (
                  <ItemBulkImageEditor
                    squareUrl={bulkSquareImageUrl}
                    onChooseSquare={() => setImageModalTarget('square')}
                    onClearSquare={() => setBulkSquareImageUrl('')}
                    landscapeUrl={bulkLandscapeImageUrl}
                    onChooseLandscape={() => setImageModalTarget('landscape')}
                    onClearLandscape={() => setBulkLandscapeImageUrl('')}
                  />
                )}
              </section>

              <TaxSection value={taxAction} onChange={setTaxAction} customTaxes={customTaxes} taxRate={taxRate} />
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
                coverage={optionCoverage}
                total={modifierIds.length}
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
            <>
              <VisibilitySection
                apply={applyCatVisibility}
                setApply={setApplyCatVisibility}
                vis={catVis}
                setVis={setCatVis}
              />

              {/* Image */}
              <section>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={applyCatImage} onChange={(e) => setApplyCatImage(e.target.checked)} className="accent-primary cursor-pointer" />
                  <span className="section-header">Image</span>
                </label>
                {applyCatImage && (
                  <BulkImageEditor
                    mode={catImageMode}
                    setMode={setCatImageMode}
                    entityLabel="categories"
                    allUrl={bulkCatImageUrl}
                    onChooseAll={() => setCatImageModalTarget('all')}
                    onClearAll={() => setBulkCatImageUrl('')}
                    slots={CAT_IMAGE_SLOTS}
                    slotValues={catSlotImages}
                    onChooseSlot={(field) => setCatImageModalTarget(field)}
                    onClearSlot={(field) => setCatSlotImages((prev) => ({ ...prev, [field]: '' }))}
                  />
                )}
              </section>

              <TaxSection value={taxAction} onChange={setTaxAction} customTaxes={customTaxes} taxRate={taxRate} />
            </>
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

      <CategoryImageLibraryModal
        open={imageModalTarget !== null}
        title={imageModalTarget === 'landscape' ? 'Item image — 16:9' : 'Item image — 1:1'}
        onOpenChange={(open) => { if (!open) setImageModalTarget(null); }}
        onSelect={(url) => {
          if (imageModalTarget === 'square') setBulkSquareImageUrl(url);
          else if (imageModalTarget === 'landscape') setBulkLandscapeImageUrl(url);
        }}
      />

      <CategoryImageLibraryModal
        open={catImageModalTarget !== null}
        title={
          catImageModalTarget === 'all' || catImageModalTarget === null
            ? 'Category image (all slots)'
            : `Category image — ${CAT_IMAGE_SLOTS.find((s) => s.field === catImageModalTarget)?.label ?? ''}`
        }
        onOpenChange={(open) => { if (!open) setCatImageModalTarget(null); }}
        onSelect={(url) => {
          if (catImageModalTarget === 'all') setBulkCatImageUrl(url);
          else if (catImageModalTarget) setCatSlotImages((prev) => ({ ...prev, [catImageModalTarget]: url }));
        }}
      />
    </div>
  );
}
