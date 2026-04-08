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
    return itemModifiers
      .filter((im) => im.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((im) => modifiers.find((m) => m.id === im.modifierId))
      .filter((m): m is Modifier => m !== undefined);
  }, [itemModifiers, item.id, modifiers]);

  // Default to size modifier tab if one exists
  const defaultTabIdx = useMemo(() => {
    const sizeIdx = attachedModifiers.findIndex((m) => m.isSizeModifier);
    return sizeIdx >= 0 ? sizeIdx : 0;
  }, [attachedModifiers]);

  const [activeModifierIdx, setActiveModifierIdx] = useState(defaultTabIdx);
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

  const activeModifier = attachedModifiers[activeModifierIdx] ?? null;

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
      return { ...prev, [modifierId]: [optionId] };
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

  const currentOptions = activeModifier ? getOptions(activeModifier.id) : [];

  return (
    <div className="flex flex-col h-full min-h-0">
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
          {/* Modifier tabs */}
          <div className="flex border-b border-zinc-800 shrink-0 overflow-x-auto">
            {attachedModifiers.map((mod, idx) => {
              const isLocked = !mod.isSizeModifier && !sizeIsSelected && sizeModifier !== null;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => !isLocked && setActiveModifierIdx(idx)}
                  disabled={isLocked}
                  className={cn(
                    'px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
                    isLocked
                      ? 'border-transparent text-zinc-700 cursor-not-allowed'
                      : idx === activeModifierIdx
                      ? 'border-[hsl(var(--pos-accent))] text-zinc-100 bg-white/[0.03]'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {mod.posDisplayName || mod.modifierName}
                  {mod.isSizeModifier && (
                    <span className="ml-1.5 text-[9px] text-purple-400 font-bold uppercase tracking-wider">
                      Size
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Size prompt banner */}
          {sizeModifier && !sizeIsSelected && (
            <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20 text-purple-300 text-xs font-medium text-center">
              Select a size to unlock toppings
            </div>
          )}

          {/* Options grid */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {activeModifier && (() => {
              const childMods = getChildModifiers(activeModifier);

              // Nested modifier rendering: group options by child modifier
              if (childMods.length > 0) {
                return (
                  <div className="space-y-5">
                    {childMods.map((child) => {
                      const childOptions = getOptions(child.id);
                      return (
                        <div key={child.id}>
                          <p className="text-[10px] text-zinc-400 mb-2 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                            {child.posDisplayName || child.modifierName}
                            {child.isOptional && (
                              <span className="normal-case text-zinc-600 font-normal">
                                • {child.isOptional}
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {childOptions.map(({ modifierOptionId, option, isDefaultSelected }) => {
                              const activeSelections = selectedOptions[child.id];
                              const isSelected =
                                activeSelections !== undefined
                                  ? activeSelections.includes(modifierOptionId)
                                  : isDefaultSelected;
                              return (
                                <button
                                  key={modifierOptionId}
                                  type="button"
                                  onClick={() =>
                                    toggleOption(child.id, modifierOptionId, child.multiSelect)
                                  }
                                  className={cn(
                                    `${POS_TILE_FRAME} flex items-center justify-center px-2.5 text-xs font-semibold text-center transition-all border`,
                                    isSelected
                                      ? 'bg-orange-500/20 border-[hsl(var(--pos-accent))] text-[hsl(var(--pos-accent-muted))]'
                                      : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800',
                                  )}
                                  style={{ borderLeftWidth: 4, borderLeftColor: categoryColor }}
                                >
                                  <span className="line-clamp-2 leading-tight px-0.5">
                                    {option?.posDisplayName || option?.optionName}
                                  </span>
                                </button>
                              );
                            })}
                            {childOptions.length === 0 && (
                              <p className="w-full text-center text-zinc-600 text-xs py-2">
                                No options defined
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Standard flat rendering
              return (
                <div>
                  {activeModifier.isOptional && (
                    <p className="text-[10px] text-zinc-600 mb-2.5 uppercase tracking-wider font-medium">
                      {activeModifier.isOptional}
                    </p>
                  )}

                  {/* Pizza side selector */}
                  {activeModifier.pizzaSelection && (
                    <div className="flex gap-1.5 mb-3">
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
                    {currentOptions.map(({ modifierOptionId, option, isDefaultSelected }) => {
                      const isPizza = activeModifier.pizzaSelection;
                      const activeSelections = selectedOptions[activeModifier.id];
                      const pizzaSide = pizzaSides[modifierOptionId];
                      const isSelected = isPizza
                        ? pizzaSide !== undefined
                        : activeSelections !== undefined
                        ? activeSelections.includes(modifierOptionId)
                        : isDefaultSelected;

                      return (
                        <button
                          key={modifierOptionId}
                          type="button"
                          onClick={() =>
                            isPizza
                              ? togglePizzaOption(activeModifier.id, modifierOptionId)
                              : toggleOption(activeModifier.id, modifierOptionId, activeModifier.multiSelect)
                          }
                          className={cn(
                            `${POS_TILE_FRAME} flex items-center justify-center px-2.5 text-xs font-semibold text-center transition-all border relative`,
                            isSelected
                              ? 'bg-orange-500/20 border-[hsl(var(--pos-accent))] text-[hsl(var(--pos-accent-muted))]'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800',
                          )}
                          style={{ borderLeftWidth: 4, borderLeftColor: categoryColor }}
                        >
                          <span className="line-clamp-2 leading-tight px-0.5">
                            {option?.posDisplayName || option?.optionName}
                          </span>
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
                        </button>
                      );
                    })}
                    {currentOptions.length === 0 && (
                      <p className="w-full text-center text-zinc-600 text-xs py-6">No options defined</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
