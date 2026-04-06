import { useState, useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';
import type { Item, Modifier } from '@/types/menu';
import { POS_TILE_FRAME } from './posTileStyles';

interface ModifierPanelProps {
  item: Item;
  categoryColor: string;
  onDone: (item: Item, selectedOptions: Record<number, number[]>, qty: number) => void;
  onCancel: () => void;
}

export function ModifierPanel({ item, categoryColor, onDone, onCancel }: ModifierPanelProps) {
  const { itemModifiers, modifiers, modifierModifierOptions, modifierOptions } = useMenuStore();

  const attachedModifiers = useMemo(() => {
    return itemModifiers
      .filter((im) => im.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((im) => modifiers.find((m) => m.id === im.modifierId))
      .filter((m): m is Modifier => m !== undefined);
  }, [itemModifiers, item.id, modifiers]);

  const [activeModifierIdx, setActiveModifierIdx] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>(() => {
    const defaults: Record<number, number[]> = {};
    for (const im of itemModifiers.filter((im) => im.itemId === item.id)) {
      const defaultOpts = modifierModifierOptions
        .filter((mmo) => mmo.modifierId === im.modifierId && mmo.isDefaultSelected)
        .map((mmo) => mmo.modifierOptionId);
      if (defaultOpts.length > 0) defaults[im.modifierId] = defaultOpts;
    }
    return defaults;
  });
  const [qty, setQty] = useState(1);

  const activeModifier = attachedModifiers[activeModifierIdx] ?? null;

  const getOptions = (modifierId: number) => {
    return modifierModifierOptions
      .filter((mmo) => mmo.modifierId === modifierId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((mmo) => ({
        ...mmo,
        option: modifierOptions.find((o) => o.id === mmo.modifierOptionId),
      }))
      .filter((o) => o.option !== undefined);
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

  const currentOptions = activeModifier ? getOptions(activeModifier.id) : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Item header with Cancel/Done in top-right */}
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
            onClick={() => onDone(item, selectedOptions, qty)}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[hsl(var(--pos-primary))] hover:bg-[hsl(var(--pos-primary-hover))] transition-colors"
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
            {attachedModifiers.map((mod, idx) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveModifierIdx(idx)}
                className={cn(
                  'px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
                  idx === activeModifierIdx
                    ? 'border-[hsl(var(--pos-accent))] text-zinc-100 bg-white/[0.03]'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300',
                )}
              >
                {mod.posDisplayName || mod.modifierName}
              </button>
            ))}
          </div>

          {/* Options grid */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {activeModifier && (
              <div>
                {activeModifier.isOptional && (
                  <p className="text-[10px] text-zinc-600 mb-2.5 uppercase tracking-wider font-medium">
                    {activeModifier.isOptional}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {currentOptions.map(({ modifierOptionId, option, isDefaultSelected }) => {
                    const activeSelections = selectedOptions[activeModifier.id];
                    const isSelected =
                      activeSelections !== undefined
                        ? activeSelections.includes(modifierOptionId)
                        : isDefaultSelected;
                    return (
                      <button
                        key={modifierOptionId}
                        type="button"
                        onClick={() =>
                          toggleOption(
                            activeModifier.id,
                            modifierOptionId,
                            activeModifier.multiSelect,
                          )
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
                  {currentOptions.length === 0 && (
                    <p className="w-full text-center text-zinc-600 text-xs py-6">No options defined</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
