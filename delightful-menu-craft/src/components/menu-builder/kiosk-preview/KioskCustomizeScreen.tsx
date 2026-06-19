import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { ChevronLeft, Minus, Plus, UtensilsCrossed, Check } from 'lucide-react';
import type { Item, Modifier } from '@/types/menu';
import { modifierSurchargePerUnit } from '@/lib/posPricing';
import {
  getEffectiveModType,
  buildInitialModifierState,
  getChildModifiersForInit,
  filterRootItemModifiers,
  isMeaningfulOptionalLabel,
} from '../pos-preview/ModifierPanel';

interface KioskCustomizeScreenProps {
  item: Item;
  initialSelectedOptions?: Record<number, number[]>;
  initialQty?: number;
  onAddToCart: (item: Item, selectedOptions: Record<number, number[]>, qty: number) => void;
  onBack: () => void;
}

/**
 * Kiosk item-customize screen. Visuals are kiosk-styled and lighter than the
 * real kiosk (no pizza-side L/R/W strip), but the selection/validity/pricing
 * logic mirrors the POS ModifierPanel so subtotals match exactly.
 */
export function KioskCustomizeScreen({
  item,
  initialSelectedOptions,
  initialQty,
  onAddToCart,
  onBack,
}: KioskCustomizeScreenProps) {
  const { itemModifiers, modifiers, modifierModifierOptions, modifierOptions } = useMenuStore();
  const [imgError, setImgError] = useState(false);

  const attachedModifiers = useMemo(() => {
    const raw = itemModifiers
      .filter((im) => im.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((im) => modifiers.find((m) => m.id === im.modifierId))
      .filter((m): m is Modifier => m !== undefined);
    return filterRootItemModifiers(raw, modifiers);
  }, [itemModifiers, item.id, modifiers]);

  const [{ selectedOptions: seededSelections }] = useState(() =>
    buildInitialModifierState(
      item,
      initialSelectedOptions,
      itemModifiers,
      modifiers,
      modifierModifierOptions,
      modifierOptions,
    ),
  );
  const [selectedOptions, setSelectedOptions] = useState(seededSelections);
  const [qty, setQty] = useState(() => initialQty ?? 1);

  const sizeModifier = attachedModifiers.find((m) => m.isSizeModifier) ?? null;
  const sizeIsSelected = sizeModifier
    ? (selectedOptions[sizeModifier.id]?.length ?? 0) > 0
    : true;

  /** Options for a modifier: primary join-table path, fallback to parentModifierId. */
  const getOptions = (modifierId: number) => {
    const joinEntries = modifierModifierOptions.filter((mmo) => mmo.modifierId === modifierId);
    if (joinEntries.length > 0) {
      return joinEntries
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((mmo) => ({ ...mmo, option: modifierOptions.find((o) => o.id === mmo.modifierOptionId) }))
        .filter((o) => o.option !== undefined);
    }
    return modifierOptions
      .filter((o) => o.parentModifierId === modifierId)
      .map((o, idx) => ({
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

  const getChildModifiers = (modifier: Modifier) => getChildModifiersForInit(modifier, modifiers);

  const toggleOption = (mod: Modifier, optionId: number) => {
    const isMultiSelect = mod.multiSelect || mod.noMaxSelection || mod.maxSelector > 1;
    setSelectedOptions((prev) => {
      const current = prev[mod.id] ?? [];
      if (isMultiSelect) {
        if (current.includes(optionId)) {
          return { ...prev, [mod.id]: current.filter((id) => id !== optionId) };
        }
        if (!mod.noMaxSelection && mod.maxSelector > 0 && current.length >= mod.maxSelector) return prev;
        return { ...prev, [mod.id]: [...current, optionId] };
      }
      if (current.length === 1 && current[0] === optionId) {
        return { ...prev, [mod.id]: [] };
      }
      return { ...prev, [mod.id]: [optionId] };
    });
  };

  const incrementOption = (mod: Modifier, optionId: number, maxQty: number) => {
    setSelectedOptions((prev) => {
      const current = prev[mod.id] ?? [];
      const currentCount = current.filter((id) => id === optionId).length;
      if (maxQty > 0 && currentCount >= maxQty) return prev;
      if (!mod.noMaxSelection && mod.maxSelector > 0 && current.length >= mod.maxSelector) return prev;
      return { ...prev, [mod.id]: [...current, optionId] };
    });
  };

  const decrementOption = (mod: Modifier, optionId: number) => {
    setSelectedOptions((prev) => {
      const current = prev[mod.id] ?? [];
      const idx = current.lastIndexOf(optionId);
      if (idx === -1) return prev;
      const next = [...current];
      next.splice(idx, 1);
      return { ...prev, [mod.id]: next };
    });
  };

  /** Every group meets min/max (Required implies min 1); size must be chosen first. */
  const canAddToCart = useMemo(() => {
    if (attachedModifiers.length === 0) return true;
    if (sizeModifier && !sizeIsSelected) return false;

    const optionCount = (modifierId: number) => {
      const join = modifierModifierOptions.filter((mmo) => mmo.modifierId === modifierId);
      if (join.length > 0) return join.length;
      return modifierOptions.filter((o) => o.parentModifierId === modifierId).length;
    };

    const check = (mod: Modifier): boolean => {
      const children = getChildModifiers(mod);
      if (children.length > 0) return children.every(check);
      if (optionCount(mod.id) === 0) return true;
      const count = selectedOptions[mod.id]?.length ?? 0;
      const minReq = getEffectiveModType(mod) === 'Required' ? Math.max(mod.minSelector, 1) : mod.minSelector;
      const maxReq = mod.noMaxSelection ? Number.POSITIVE_INFINITY : mod.maxSelector;
      return count >= minReq && count <= maxReq;
    };

    return attachedModifiers.every(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedModifiers, selectedOptions, sizeModifier, sizeIsSelected, modifiers, modifierModifierOptions, modifierOptions]);

  const surchargePerUnit = modifierSurchargePerUnit(selectedOptions, modifierModifierOptions);
  const linePrice = (item.itemPrice + surchargePerUnit) * qty;
  const showImage = item.kioskItemImage && !imgError;

  /** Render a modifier group (recurses into nested child groups). */
  const renderModifier = (mod: Modifier, locked: boolean): JSX.Element => {
    const children = getChildModifiers(mod);
    const et = getEffectiveModType(mod);
    const ruleLabel =
      et === 'Required'
        ? 'Required'
        : et === 'Push Optional'
          ? 'Pre-selected'
          : isMeaningfulOptionalLabel(mod.isOptional)
            ? mod.isOptional
            : 'Optional';

    return (
      <section key={mod.id} className="border-b border-black/5 py-4 last:border-0">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-[#242528]">
            {mod.posDisplayName || mod.modifierName}
            {mod.isSizeModifier && (
              <span className="ml-2 rounded bg-[#ED7C69]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ED7C69]">
                Size
              </span>
            )}
          </h3>
          <span className="text-xs font-medium uppercase tracking-wide text-[#9A9A9A]">{ruleLabel}</span>
        </div>

        {locked ? (
          <p className="text-sm text-[#9A9A9A]">Select a size first to unlock.</p>
        ) : children.length > 0 ? (
          <div className="space-y-2">{children.map((child) => renderModifier(child, false))}</div>
        ) : (
          <div className="space-y-2">{renderOptions(mod)}</div>
        )}
      </section>
    );
  };

  const renderOptions = (mod: Modifier) => {
    const options = getOptions(mod.id);
    if (options.length === 0) {
      return <p className="text-sm text-[#9A9A9A]">No options defined</p>;
    }
    return options.map(({ modifierOptionId, option, maxQtyPerOption = 1, maxLimit }) => {
      const surcharge = typeof maxLimit === 'number' && maxLimit > 0 ? maxLimit : 0;
      const current = selectedOptions[mod.id] ?? [];
      const isMultiQty = maxQtyPerOption !== 1;
      const count = current.filter((id) => id === modifierOptionId).length;
      const isSelected = isMultiQty ? count > 0 : current.includes(modifierOptionId);

      return (
        <div
          key={modifierOptionId}
          className={cn(
            'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors',
            isSelected ? 'border-[#ED7C69] bg-[#ED7C69]/8' : 'border-black/10 bg-white',
          )}
        >
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-[#242528]">
              {option?.posDisplayName || option?.optionName}
            </span>
            {surcharge > 0 && (
              <span className="text-xs font-semibold tabular-nums text-[#ED7C69]">
                +${surcharge.toFixed(2)}
              </span>
            )}
          </div>

          {isMultiQty ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => decrementOption(mod, modifierOptionId)}
                disabled={count === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B] disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center text-sm font-semibold tabular-nums text-[#242528]">{count}</span>
              <button
                type="button"
                onClick={() => incrementOption(mod, modifierOptionId, maxQtyPerOption)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => toggleOption(mod, modifierOptionId)}
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                isSelected ? 'border-[#ED7C69] bg-[#ED7C69] text-white' : 'border-black/20 bg-white',
              )}
              aria-label={isSelected ? 'Deselect' : 'Select'}
            >
              {isSelected && <Check className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B6B6B] hover:bg-[#F1F1F1]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#F1F1F1]">
          {showImage ? (
            <img
              src={item.kioskItemImage}
              alt={item.itemName}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#C9C9C9]">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-[#242528]">
            {item.posDisplayName || item.itemName}
          </h2>
          <p className="text-sm tabular-nums text-[#9A9A9A]">${item.itemPrice.toFixed(2)}</p>
        </div>
      </div>

      {/* Size prompt */}
      {sizeModifier && !sizeIsSelected && (
        <div className="shrink-0 bg-[#ED7C69]/10 px-4 py-2 text-center text-sm font-medium text-[#ED7C69]">
          Select a size to unlock the rest
        </div>
      )}

      {/* Modifier groups */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {attachedModifiers.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="aspect-square w-44 overflow-hidden rounded-2xl bg-[#F1F1F1]">
              {showImage ? (
                <img
                  src={item.kioskItemImage}
                  alt={item.itemName}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#C9C9C9]">
                  <UtensilsCrossed className="h-12 w-12" />
                </div>
              )}
            </div>
            <p className="text-center text-sm text-[#6B6B6B]">
              {item.itemDescription || 'Tap “Add to Cart” to add this item to your order.'}
            </p>
          </div>
        ) : (
          attachedModifiers.map((mod) =>
            renderModifier(mod, !mod.isSizeModifier && !sizeIsSelected && sizeModifier !== null),
          )
        )}
      </div>

      {/* Footer: qty + add to cart */}
      <div className="flex shrink-0 items-center gap-3 border-t border-black/5 bg-white px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B]"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-6 text-center text-base font-semibold tabular-nums text-[#242528]">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          disabled={!canAddToCart}
          onClick={() => canAddToCart && onAddToCart(item, selectedOptions, qty)}
          className={cn(
            'flex flex-1 items-center justify-between rounded-2xl px-5 py-3.5 text-base font-semibold text-white transition-colors',
            canAddToCart ? 'bg-[#ED7C69] hover:bg-[#E06A55]' : 'cursor-not-allowed bg-[#D9D9D9]',
          )}
        >
          <span>{initialSelectedOptions !== undefined ? 'Update Cart' : 'Add to Cart'}</span>
          <span className="tabular-nums">${linePrice.toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
}
