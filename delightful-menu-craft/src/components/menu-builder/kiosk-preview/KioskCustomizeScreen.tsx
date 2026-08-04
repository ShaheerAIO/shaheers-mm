import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { ChevronLeft, Minus, Plus, UtensilsCrossed } from 'lucide-react';
import type { Item, Modifier } from '@/types/menu';
import { effectiveUnitPrice } from '@/lib/posPricing';
import {
  getEffectiveModType,
  buildInitialModifierState,
  getChildModifiersForInit,
  filterRootItemModifiers,
} from '../pos-preview/ModifierPanel';

interface KioskCustomizeScreenProps {
  item: Item;
  initialSelectedOptions?: Record<number, number[]>;
  initialQty?: number;
  cartCount: number;
  onAddToCart: (item: Item, selectedOptions: Record<number, number[]>, qty: number) => void;
  onViewCart: () => void;
  onBack: () => void;
}

/** Green "Required" / gray "Optional" (or "Pre-selected") badge per group. */
function ruleBadge(mod: Modifier) {
  const et = getEffectiveModType(mod);
  if (et === 'Required') return { label: 'Required', className: 'bg-[#3FBF8F] text-white' };
  if (et === 'Push Optional') return { label: 'Pre-selected', className: 'bg-[#B7B7B7] text-white' };
  return { label: 'Optional', className: 'bg-[#B7B7B7] text-white' };
}

/** Coral helper line under a group heading ("Select 1" / "Select any (optional)"). */
function selectionHint(mod: Modifier): string {
  const et = getEffectiveModType(mod);
  if (et === 'Required') {
    const max = mod.noMaxSelection ? 0 : mod.maxSelector;
    if (max === 1) return 'Select 1';
    if (mod.minSelector > 0) return `Select ${mod.minSelector}${max > mod.minSelector ? `–${max}` : ''}`;
    return max > 0 ? `Select up to ${max}` : 'Select any';
  }
  return 'Select any (optional)';
}

/**
 * Kiosk item-customize screen. Visuals mirror the kiosk design (centered hero
 * image, colored rule badges, chip-style options); the selection/validity/
 * pricing logic mirrors the POS ModifierPanel so subtotals match exactly.
 */
export function KioskCustomizeScreen({
  item,
  initialSelectedOptions,
  initialQty,
  cartCount,
  onAddToCart,
  onViewCart,
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

    const check = (mod: Modifier, isChild = false): boolean => {
      const children = getChildModifiers(mod);
      if (children.length > 0) return children.every((child) => check(child, true));
      if (optionCount(mod.id) === 0) return true;
      const count = selectedOptions[mod.id]?.length ?? 0;
      // Nested children: Min is the source of truth (0 = optional, >=1 = required).
      const minReq = isChild
        ? mod.minSelector
        : getEffectiveModType(mod) === 'Required' ? Math.max(mod.minSelector, 1) : mod.minSelector;
      const maxReq = mod.noMaxSelection ? Number.POSITIVE_INFINITY : mod.maxSelector;
      return count >= minReq && count <= maxReq;
    };

    return attachedModifiers.every((mod) => check(mod));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachedModifiers, selectedOptions, sizeModifier, sizeIsSelected, modifiers, modifierModifierOptions, modifierOptions]);

  const unitPrice = effectiveUnitPrice(item.itemPrice, selectedOptions, attachedModifiers, modifierModifierOptions);
  const linePrice = unitPrice * qty;
  const showImage = item.kioskItemImage && !imgError;

  /** One option rendered as a selectable chip (with a ± stepper for multi-qty). */
  const renderOptionChip = (
    mod: Modifier,
    o: { modifierOptionId: number; option?: { posDisplayName?: string; optionName?: string }; maxQtyPerOption?: number; maxLimit: number },
  ) => {
    const { modifierOptionId, option, maxQtyPerOption = 1, maxLimit } = o;
    const surcharge = typeof maxLimit === 'number' && maxLimit > 0 ? maxLimit : 0;
    const current = selectedOptions[mod.id] ?? [];
    const isMultiQty = maxQtyPerOption !== 1;
    const count = current.filter((id) => id === modifierOptionId).length;
    const isSelected = isMultiQty ? count > 0 : current.includes(modifierOptionId);
    const name = option?.posDisplayName || option?.optionName || '';
    const priceLabel = surcharge > 0 ? (mod.isSizeModifier ? ` $${surcharge.toFixed(2)}` : ` +$${surcharge.toFixed(2)}`) : '';

    if (isMultiQty) {
      return (
        <div
          key={modifierOptionId}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
            isSelected ? 'border-[#ED7C69] bg-[#ED7C69]/8 text-[#ED7C69]' : 'border-black/15 bg-white text-[#242528]',
          )}
        >
          <span>
            {name}
            {priceLabel && <span className="tabular-nums">{priceLabel}</span>}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => decrementOption(mod, modifierOptionId)}
              disabled={count === 0}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B] disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-4 text-center tabular-nums">{count}</span>
            <button
              type="button"
              onClick={() => incrementOption(mod, modifierOptionId, maxQtyPerOption)}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-[#6B6B6B]"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <button
        key={modifierOptionId}
        type="button"
        onClick={() => toggleOption(mod, modifierOptionId)}
        className={cn(
          'rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
          isSelected ? 'border-[#ED7C69] bg-[#ED7C69]/8 text-[#ED7C69]' : 'border-black/15 bg-white text-[#242528]',
        )}
      >
        {name}
        {priceLabel && <span className="tabular-nums">{priceLabel}</span>}
      </button>
    );
  };

  /** Render a modifier group (recurses into nested child groups). */
  const renderModifier = (mod: Modifier, locked: boolean): JSX.Element => {
    const children = getChildModifiers(mod);
    const badge = ruleBadge(mod);
    const options = getOptions(mod.id);

    return (
      <section key={mod.id} className="py-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-[#242528]">{mod.posDisplayName || mod.modifierName}</h3>
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', badge.className)}>{badge.label}</span>
        </div>
        {!locked && <p className="mb-3 text-sm font-medium text-[#ED7C69]">{selectionHint(mod)}</p>}

        {locked ? (
          <p className="text-sm text-[#9A9A9A]">Select a size first to unlock.</p>
        ) : children.length > 0 ? (
          <div className="space-y-3">{children.map((child) => renderModifier(child, false))}</div>
        ) : options.length === 0 ? (
          <p className="text-sm text-[#9A9A9A]">No options defined</p>
        ) : (
          <div className="flex flex-wrap gap-2">{options.map((o) => renderOptionChip(mod, o))}</div>
        )}
      </section>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#FAFAFA]">
      {/* Header: Go back */}
      <div className="flex shrink-0 items-center border-b border-black/5 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-semibold text-[#ED7C69]"
        >
          <ChevronLeft className="h-5 w-5" />
          Go back
        </button>
      </div>

      {/* Size prompt */}
      {sizeModifier && !sizeIsSelected && (
        <div className="shrink-0 bg-[#ED7C69]/10 px-4 py-2 text-center text-sm font-medium text-[#ED7C69]">
          Select a size to unlock the rest
        </div>
      )}

      {/* Scroll body: hero + modifier groups */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {/* Hero: centered image, name, price */}
        <div className="flex flex-col items-center gap-2 pb-2 pt-5">
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
          <h2 className="text-center text-xl font-bold text-[#242528]">
            {item.posDisplayName || item.itemName}
          </h2>
          <p className="text-lg font-bold tabular-nums text-[#ED7C69]">${unitPrice.toFixed(2)}</p>
        </div>

        {attachedModifiers.length === 0 ? (
          item.itemDescription ? (
            <p className="pb-6 text-center text-sm text-[#6B6B6B]">{item.itemDescription}</p>
          ) : (
            <p className="pb-6 text-center text-sm text-[#9A9A9A]">
              Tap “Add to cart” to add this item to your order.
            </p>
          )
        ) : (
          <div className="divide-y divide-black/5 pb-4">
            {attachedModifiers.map((mod) =>
              renderModifier(mod, !mod.isSizeModifier && !sizeIsSelected && sizeModifier !== null),
            )}
          </div>
        )}

        {/* Quantity */}
        <div className="flex items-center justify-between border-t border-black/5 py-4">
          <h3 className="text-base font-bold text-[#242528]">Quantity</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 text-[#6B6B6B]"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-base font-semibold tabular-nums text-[#242528]">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ED7C69] text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer: View cart + Add to cart */}
      <div className="flex shrink-0 items-center gap-3 border-t border-black/5 bg-white px-4 py-4">
        <button
          type="button"
          onClick={onViewCart}
          className="rounded-2xl border border-[#ED7C69] px-5 py-3 text-sm font-semibold text-[#ED7C69] transition-colors hover:bg-[#ED7C69]/5"
        >
          View cart{cartCount > 0 ? ` (${cartCount})` : ''}
        </button>
        <button
          type="button"
          disabled={!canAddToCart}
          onClick={() => canAddToCart && onAddToCart(item, selectedOptions, qty)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-2xl px-5 py-3 text-base font-semibold text-white transition-colors',
            canAddToCart ? 'bg-[#ED7C69] hover:bg-[#E06A55]' : 'cursor-not-allowed bg-[#D9D9D9]',
          )}
        >
          <span>{initialSelectedOptions !== undefined ? 'Update cart' : 'Add to cart'}</span>
          <span className="tabular-nums">(${linePrice.toFixed(2)})</span>
        </button>
      </div>
    </div>
  );
}
