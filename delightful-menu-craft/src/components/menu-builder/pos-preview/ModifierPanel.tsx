import { useState, useMemo, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';
import type {
  Item,
  Modifier,
  ModifierOption,
  ModifierModifierOption,
  ItemModifier,
} from '@/types/menu';
import { POS_TILE_FRAME } from './posTileStyles';

/** ItemModifiers often list nested mods explicitly; hide any mod that is a child of another linked mod. */
function filterRootItemModifiers(linked: Modifier[], allModifiers: Modifier[]): Modifier[] {
  if (linked.length <= 1) return linked;
  return linked.filter((m) => {
    for (const p of linked) {
      if (p.id === m.id) continue;
      const children = getChildModifiersForInit(p, allModifiers);
      if (children.some((c) => c.id === m.id)) return false;
    }
    return true;
  });
}

type PizzaSide = 'left' | 'right' | 'whole';

function getChildModifiersForInit(modifier: Modifier, allModifiers: Modifier[]): Modifier[] {
  if (modifier.modifierIds) {
    const fromIds = modifier.modifierIds
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id) && id > 0)
      .map((id) => allModifiers.find((m) => m.id === id))
      .filter((m): m is Modifier => m !== undefined);
    if (fromIds.length > 0) return fromIds;
  }
  return allModifiers.filter((m) => m.parentModifierId === modifier.id);
}

/** Seed defaults from join table, overlay saved ticket selections, derive pizza sides for edit flows. */
function buildInitialModifierState(
  item: Item,
  initialSelectedOptions: Record<number, number[]> | undefined,
  itemModifiers: ItemModifier[],
  modifiers: Modifier[],
  modifierModifierOptions: ModifierModifierOption[],
  modifierOptions: ModifierOption[],
): { selectedOptions: Record<number, number[]>; pizzaSides: Record<number, PizzaSide> } {
  const defaults: Record<number, number[]> = {};
  const seedDefaults = (modId: number) => {
    const defaultOpts = modifierModifierOptions
      .filter((mmo) => mmo.modifierId === modId && mmo.isDefaultSelected)
      .map((mmo) => mmo.modifierOptionId);
    if (defaultOpts.length > 0) defaults[modId] = defaultOpts;
    const mod = modifiers.find((m) => m.id === modId);
    if (!mod) return;
    const childIds: number[] = mod.modifierIds
      ? mod.modifierIds
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id) && id > 0)
      : modifiers.filter((m) => m.parentModifierId === modId).map((m) => m.id);
    childIds.forEach(seedDefaults);
  };
  itemModifiers.filter((im) => im.itemId === item.id).forEach((im) => seedDefaults(im.modifierId));

  const merged: Record<number, number[]> = { ...defaults };
  if (initialSelectedOptions) {
    for (const [key, arr] of Object.entries(initialSelectedOptions)) {
      const id = Number(key);
      if (!isNaN(id) && Array.isArray(arr)) merged[id] = [...arr];
    }
  }

  const pizzaSides: Record<number, PizzaSide> = {};
  const visitPizza = (mod: Modifier) => {
    const children = getChildModifiersForInit(mod, modifiers);
    if (children.length > 0) {
      children.forEach(visitPizza);
      return;
    }
    if (mod.pizzaSelection) {
      for (const oid of merged[mod.id] ?? []) {
        pizzaSides[oid] = 'whole';
      }
    }
  };
  itemModifiers
    .filter((im) => im.itemId === item.id)
    .map((im) => modifiers.find((m) => m.id === im.modifierId))
    .filter((m): m is Modifier => m !== undefined)
    .forEach((m) => visitPizza(m));

  return { selectedOptions: merged, pizzaSides };
}

/** Excel often exports booleans as the string "FALSE" — don't show as a rule header. */
function isMeaningfulOptionalLabel(value: string | undefined): boolean {
  const t = value?.trim() ?? '';
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower === 'false' || lower === 'true') return false;
  // Legacy / noisy default; don't show as a rule line in POS
  if (lower === 'select any') return false;
  return true;
}

const SIDE_LABELS: Record<PizzaSide, string> = { left: 'Left Half', right: 'Right Half', whole: 'Whole' };
const SIDE_SHORT: Record<PizzaSide, string> = { left: 'L', right: 'R', whole: 'W' };
const SIDE_COLORS: Record<PizzaSide, string> = { left: 'bg-blue-500', right: 'bg-green-500', whole: 'bg-orange-500' };

interface ModifierPanelProps {
  item: Item;
  categoryColor: string;
  onDone: (item: Item, selectedOptions: Record<number, number[]>, qty: number) => void;
  onCancel: () => void;
  /** When reopening a ticket line (QSR), pass saved selections so required mods stay satisfied. */
  initialSelectedOptions?: Record<number, number[]>;
  initialQty?: number;
  /** When true, POS ticket overlay should dim (same condition as Done disabled: !canPressDone). */
  onTicketBlockChange?: (blocked: boolean) => void;
}

export function ModifierPanel({
  item,
  categoryColor,
  onDone,
  onCancel,
  initialSelectedOptions,
  initialQty,
  onTicketBlockChange,
}: ModifierPanelProps) {
  const { itemModifiers, modifiers, modifierModifierOptions, modifierOptions } = useMenuStore();

  const attachedModifiers = useMemo(() => {
    const raw = itemModifiers
      .filter((im) => im.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((im) => modifiers.find((m) => m.id === im.modifierId))
      .filter((m): m is Modifier => m !== undefined);
    return filterRootItemModifiers(raw, modifiers);
  }, [itemModifiers, item.id, modifiers]);

  /** Per root modifier: drill path into nested groups (Left→sauces, etc.). */
  const [drillPathByRoot, setDrillPathByRoot] = useState<Record<number, number[]>>({});
  useEffect(() => {
    setDrillPathByRoot({});
  }, [item.id]);
  const [initialBundle] = useState(() =>
    buildInitialModifierState(
      item,
      initialSelectedOptions,
      itemModifiers,
      modifiers,
      modifierModifierOptions,
      modifierOptions,
    ),
  );
  const [selectedOptions, setSelectedOptions] = useState(() => initialBundle.selectedOptions);
  // Pizza side selection: optionId -> side chosen
  const [pizzaSides, setPizzaSides] = useState(() => initialBundle.pizzaSides);
  // Currently active side when selecting pizza toppings
  const [currentPizzaSide, setCurrentPizzaSide] = useState<PizzaSide>('whole');

  const [qty, setQty] = useState(() => initialQty ?? 1);

  // Size gating: find any size modifier; toppings are locked until size is chosen
  const sizeModifier = attachedModifiers.find((m) => m.isSizeModifier) ?? null;
  const sizeIsSelected = sizeModifier
    ? (selectedOptions[sizeModifier.id]?.length ?? 0) > 0
    : true;

  const getOptions = (modifierId: number) => {
    const joinEntries = modifierModifierOptions.filter((mmo) => mmo.modifierId === modifierId);

    const parentLinked = modifierOptions.filter((o) => o.parentModifierId === modifierId);

    if (joinEntries.length > 0) {
      // Primary path: options linked via join table
      return joinEntries
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((mmo) => ({
          ...mmo,
          option: modifierOptions.find((o) => o.id === mmo.modifierOptionId),
        }))
        .filter((o) => o.option !== undefined);
    }

    // Fallback: options linked only via parentModifierId on ModifierOption
    return parentLinked.map((o, idx) => ({
      modifierId,
      modifierOptionId: o.id,
      isDefaultSelected: false,
      maxLimit: 0,
      optionDisplayName: o.optionName,
      sortOrder: idx,
      maxQtyPerOption: 1,
      option: o,
    }));
  };

  const toggleOption = (modifierId: number, optionId: number, multiSelect: boolean) => {
    setSelectedOptions((prev) => {
      const current = prev[modifierId] ?? [];
      if (multiSelect) {
        return {
          ...prev,
          [modifierId]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      }
      // Single-select: second click on the same option clears selection
      if (current.length === 1 && current[0] === optionId) {
        return { ...prev, [modifierId]: [] };
      }
      return { ...prev, [modifierId]: [optionId] };
    });
  };

  /** Increment an option by one occurrence (for maxQtyPerOption > 1). */
  const incrementOption = (
    modifierId: number,
    optionId: number,
    multiSelect: boolean,
    maxQty: number, // 0 = unlimited
  ) => {
    setSelectedOptions((prev) => {
      const current = prev[modifierId] ?? [];
      const currentCount = current.filter((id) => id === optionId).length;
      // At cap — do nothing
      if (maxQty > 0 && currentCount >= maxQty) return prev;
      if (!multiSelect) {
        // Single-select: if a different option is already chosen, replace it
        const otherIds = current.filter((id) => id !== optionId);
        if (otherIds.length > 0) {
          return { ...prev, [modifierId]: [optionId] };
        }
      }
      return { ...prev, [modifierId]: [...current, optionId] };
    });
  };

  /** Decrement an option by one occurrence. */
  const decrementOption = (modifierId: number, optionId: number) => {
    setSelectedOptions((prev) => {
      const current = prev[modifierId] ?? [];
      const idx = current.lastIndexOf(optionId);
      if (idx === -1) return prev;
      const next = [...current];
      next.splice(idx, 1);
      return { ...prev, [modifierId]: next };
    });
  };

  const togglePizzaOption = (modifierId: number, optionId: number) => {
    const existingSide = pizzaSides[optionId];
    let newPizzaSides: Record<number, PizzaSide>;

    if (existingSide === currentPizzaSide) {
      // Deselect
      newPizzaSides = { ...pizzaSides };
      delete newPizzaSides[optionId];
    } else {
      // Select or switch side
      newPizzaSides = { ...pizzaSides, [optionId]: currentPizzaSide };
    }

    setPizzaSides(newPizzaSides);

    // Sync selectedOptions for this modifier
    const optionsForMod = getOptions(modifierId).map((o) => o.modifierOptionId);
    const selected = Object.entries(newPizzaSides)
      .filter(([k]) => optionsForMod.includes(parseInt(k)))
      .map(([k]) => parseInt(k));
    setSelectedOptions((prev) => ({ ...prev, [modifierId]: selected }));
  };

  const getChildModifiers = (modifier: Modifier): Modifier[] => {
    // Primary: explicit comma-separated modifierIds on the parent
    if (modifier.modifierIds) {
      const fromIds = modifier.modifierIds
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id) && id > 0)
        .map((id) => modifiers.find((m) => m.id === id))
        .filter((m): m is Modifier => m !== undefined);
      if (fromIds.length > 0) return fromIds;
    }
    // Fallback: find modifiers that declare this modifier as their parent
    // (Excel exports parentModifierId on children but not modifierIds on parents)
    return modifiers.filter((m) => m.parentModifierId === modifier.id);
  };

  /** True when every modifier group meets min/max (and Required implies at least minSelector, min 1). */
  const canPressDone = useMemo(() => {
    if (attachedModifiers.length === 0) return true;
    if (sizeModifier && !sizeIsSelected) return false;

    const optionCountForModifier = (modifierId: number) => {
      const joinEntries = modifierModifierOptions.filter((mmo) => mmo.modifierId === modifierId);
      if (joinEntries.length > 0) return joinEntries.length;
      return modifierOptions.filter((o) => o.parentModifierId === modifierId).length;
    };

    const checkModifier = (mod: Modifier): boolean => {
      const children = getChildModifiers(mod);
      if (children.length > 0) {
        return children.every(checkModifier);
      }
      if (optionCountForModifier(mod.id) === 0) return true;

      const count = selectedOptions[mod.id]?.length ?? 0;
      const minReq =
        mod.isOptional === 'Required' || mod.isOptional === 'Select one'
          ? Math.max(mod.minSelector, 1)
          : mod.minSelector;
      const maxReq = mod.noMaxSelection ? Number.POSITIVE_INFINITY : mod.maxSelector;
      return count >= minReq && count <= maxReq;
    };

    return attachedModifiers.every(checkModifier);
  }, [
    attachedModifiers,
    selectedOptions,
    sizeModifier,
    sizeIsSelected,
    modifiers,
    modifierModifierOptions,
    modifierOptions,
  ]);

  useEffect(() => {
    onTicketBlockChange?.(!canPressDone);
    return () => {
      onTicketBlockChange?.(false);
    };
  }, [canPressDone, onTicketBlockChange]);

  /** Leaf modifier: option tiles (and pizza side strip when applicable). */
  const renderFlatLeaf = (mod: Modifier) => {
    const currentOptions = getOptions(mod.id);
    return (
      <div>
        {isMeaningfulOptionalLabel(mod.isOptional) && (
          <p className="text-[10px] text-zinc-600 mb-2 uppercase tracking-wider font-medium">
            {mod.isOptional}
          </p>
        )}

        {mod.pizzaSelection && (
          <div className="flex gap-1.5 mb-2">
            {(['left', 'right', 'whole'] as PizzaSide[]).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => setCurrentPizzaSide(side)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-colors',
                  currentPizzaSide === side
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500',
                )}
              >
                {SIDE_LABELS[side]}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {currentOptions.map(
            ({ modifierOptionId, option, isDefaultSelected, maxQtyPerOption = 1, maxLimit }) => {
            const surcharge = typeof maxLimit === 'number' && maxLimit > 0 ? maxLimit : 0;
            const isPizza = mod.pizzaSelection;
            const activeSelections = selectedOptions[mod.id];
            const pizzaSide = pizzaSides[modifierOptionId];
            const isMultiQty = !isPizza && maxQtyPerOption !== 1;
            const qty = isMultiQty
              ? (activeSelections?.filter((id) => id === modifierOptionId).length ?? 0)
              : 0;
            const isSelected = isPizza
              ? pizzaSide !== undefined
              : isMultiQty
                ? qty > 0
                : activeSelections !== undefined
                  ? activeSelections.includes(modifierOptionId)
                  : isDefaultSelected;

            return (
              <button
                key={modifierOptionId}
                type="button"
                onClick={() =>
                  isPizza
                    ? togglePizzaOption(mod.id, modifierOptionId)
                    : isMultiQty
                      ? incrementOption(mod.id, modifierOptionId, mod.multiSelect, maxQtyPerOption)
                      : toggleOption(mod.id, modifierOptionId, mod.multiSelect)
                }
                className={cn(
                  `${POS_TILE_FRAME} flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-xs font-semibold text-center transition-all border relative`,
                  isSelected
                    ? 'bg-orange-500/20 border-[hsl(var(--pos-accent))] text-[hsl(var(--pos-accent-muted))]'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800',
                )}
                style={{ borderLeftWidth: 4, borderLeftColor: categoryColor }}
              >
                <span className="line-clamp-2 leading-tight px-0.5 min-h-0">
                  {option?.posDisplayName || option?.optionName}
                </span>
                {surcharge > 0 ? (
                  <span className="text-[10px] font-semibold text-[hsl(var(--pos-accent-muted))] tabular-nums leading-none shrink-0">
                    +${surcharge.toFixed(2)}
                  </span>
                ) : null}
                {/* Pizza side badge */}
                {isPizza && pizzaSide && (
                  <span
                    className={cn(
                      'absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white',
                      SIDE_COLORS[pizzaSide],
                    )}
                  >
                    {SIDE_SHORT[pizzaSide]}
                  </span>
                )}
                {/* Multi-qty count badge */}
                {isMultiQty && qty > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-0.5 rounded-full bg-orange-500 text-[9px] font-bold flex items-center justify-center text-white leading-none pointer-events-none">
                    ×{qty}
                  </span>
                )}
                {/* Decrement button — span with role to avoid nested <button> invalidity */}
                {isMultiQty && qty > 0 && (
                  <span
                    role="button"
                    aria-label="Decrease quantity"
                    onClick={(e) => {
                      e.stopPropagation();
                      decrementOption(mod.id, modifierOptionId);
                    }}
                    className="absolute bottom-1 left-1 w-[18px] h-[18px] rounded-full bg-zinc-700 hover:bg-zinc-500 border border-zinc-600 flex items-center justify-center text-white transition-colors cursor-pointer"
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}
          {currentOptions.length === 0 && (
            <p className="w-full text-center text-zinc-600 text-xs py-4">No options defined</p>
          )}
        </div>
      </div>
    );
  };

  /**
   * Nested modifiers: horizontal row per level; deeper levels stack below within this root.
   * `path` / `onPathChange` are scoped to one top-level modifier.
   */
  const renderNestedDrill = (
    mod: Modifier,
    depth: number,
    path: number[],
    onPathChange: (next: number[]) => void,
  ) => {
    const children = getChildModifiers(mod);
    if (children.length === 0) {
      return renderFlatLeaf(mod);
    }

    const selectedIdAtDepth = path[depth];
    const selectedChild =
      selectedIdAtDepth !== undefined
        ? children.find((c) => c.id === selectedIdAtDepth)
        : undefined;

    return (
      <div className="flex flex-col gap-2 w-full min-w-0">
        <div className="flex flex-wrap gap-2 content-start">
          {children.map((child) => {
            const isOpen = selectedIdAtDepth === child.id;
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => {
                  onPathChange(
                    path[depth] === child.id
                      ? path.slice(0, depth)
                      : [...path.slice(0, depth), child.id],
                  );
                }}
                className={cn(
                  `${POS_TILE_FRAME} flex flex-col items-center justify-center gap-0.5 px-2 text-xs font-semibold text-center transition-all border`,
                  isOpen
                    ? 'bg-orange-500/20 border-[hsl(var(--pos-accent))] text-[hsl(var(--pos-accent-muted))]'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800',
                )}
                style={{ borderLeftWidth: 4, borderLeftColor: categoryColor }}
              >
                <span className="line-clamp-3 leading-tight px-0.5">
                  {child.posDisplayName || child.modifierName}
                </span>
                {isMeaningfulOptionalLabel(child.isOptional) && (
                  <span className="text-[9px] text-zinc-500 font-normal line-clamp-1">
                    {child.isOptional}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedChild && (
          <div className="w-full min-w-0 border-t border-zinc-800/60 pt-2 flex flex-col gap-2">
            {renderNestedDrill(selectedChild, depth + 1, path, onPathChange)}
          </div>
        )}
      </div>
    );
  };

  const renderModifierBody = (rootMod: Modifier) => {
    const path = drillPathByRoot[rootMod.id] ?? [];
    const onPathChange = (next: number[]) =>
      setDrillPathByRoot((s) => ({ ...s, [rootMod.id]: next }));
    return renderNestedDrill(rootMod, 0, path, onPathChange);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Item header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 gap-3"
        style={{ borderBottom: `2px solid ${categoryColor}` }}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-100 truncate">
            {item.posDisplayName || item.itemName}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">${item.itemPrice.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-7 h-7 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:bg-white/5 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-5 text-center text-sm font-semibold text-zinc-100 tabular-nums">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="w-7 h-7 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:bg-white/5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-zinc-600 text-xs font-medium text-zinc-300 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canPressDone}
            onClick={() => {
              if (!canPressDone) return;
              onDone(item, selectedOptions, qty);
            }}
            title={
              !canPressDone
                ? 'Select all required modifier options or use Cancel'
                : undefined
            }
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
              canPressDone
                ? 'text-white bg-[hsl(var(--pos-primary))] hover:bg-[hsl(var(--pos-primary-hover))]'
                : 'text-zinc-500 bg-zinc-700 cursor-not-allowed opacity-70',
            )}
          >
            Done
          </button>
        </div>
      </div>

      {attachedModifiers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-zinc-500 text-sm">No modifiers for this item</p>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-lg border border-zinc-600 text-sm text-zinc-300 hover:bg-white/5 transition-colors"
          >
            Back
          </button>
        </div>
      ) : (
        <>
          {/* Size prompt banner */}
          {sizeModifier && !sizeIsSelected && (
            <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20 text-purple-300 text-xs font-medium text-center shrink-0">
              Select a size to unlock toppings
            </div>
          )}

          {/* Every root modifier: label tile (left) + its own horizontal rows / drill (right), all visible */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2">
            <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
              {attachedModifiers.map((mod) => {
                const isLocked =
                  !mod.isSizeModifier && !sizeIsSelected && sizeModifier !== null;
                return (
                  <div
                    key={mod.id}
                    className="flex flex-row gap-2 sm:gap-3 items-start border-b border-zinc-800/60 pb-4 last:border-0 last:pb-0"
                  >
                    <div
                      className={cn(
                        `${POS_TILE_FRAME} shrink-0 flex flex-col items-center justify-center gap-0.5 px-2 text-xs font-semibold text-center border pointer-events-none select-none cursor-default`,
                        isLocked
                          ? 'border-zinc-800 text-zinc-500 opacity-60'
                          : 'border-zinc-600 text-zinc-200',
                      )}
                      style={{
                        borderLeftWidth: 4,
                        // Swapped vs option tiles: stripe is neutral "main", fill carries category accent
                        borderLeftColor: isLocked ? '#3f3f46' : '#71717a',
                        background: isLocked
                          ? 'rgb(9 9 11 / 0.85)'
                          : `color-mix(in srgb, ${categoryColor} 22%, rgb(39 39 42 / 0.92))`,
                      }}
                    >
                      <span className="line-clamp-3 leading-tight px-0.5">
                        {mod.posDisplayName || mod.modifierName}
                      </span>
                      {mod.isSizeModifier && (
                        <span
                          className={cn(
                            'text-[9px] font-bold uppercase tracking-wider',
                            isLocked ? 'text-zinc-500' : 'text-purple-400',
                          )}
                        >
                          Size
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-2 pt-0">
                      {isLocked ? (
                        <p className="text-xs text-zinc-500">Select a size first to unlock.</p>
                      ) : (
                        renderModifierBody(mod)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
