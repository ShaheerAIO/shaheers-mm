import { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getItemModifierConfig,
  getModifierDescendantIds,
  isItemModifierCustomized,
  resolveItemModifierOptions,
  visibleItemModifierOptions,
  type OverrideData,
  type ResolvedOption,
} from '@/lib/optionOverrides';
import type { Modifier, OptionOverridePatch } from '@/types/menu';
import { cn } from '@/lib/utils';

// =============================================================================
// Demo: per-item customization of a shared modifier (presets + option overrides)
// as shown in the item panel's attached-modifiers list.
// =============================================================================

const NONE = 'none';
const SAVE_AS = 'save-as';

/** The preset assigned to (item, modifier), if any. */
function useAssignedPreset(itemId: number, modifierId: number) {
  const configs = useMenuStore((s) => s.itemModifierConfigs);
  const presets = useMenuStore((s) => s.modifierPresets);
  const presetId = getItemModifierConfig(configs, itemId, modifierId)?.presetId ?? null;
  return presetId != null
    ? presets.find((p) => p.id === presetId && p.modifierId === modifierId)
    : undefined;
}

/**
 * One (item, modifier)'s resolved options keyed by option id, plus patch builders
 * for the item layer. A patch clears the field (null) instead of writing an
 * override when the new value matches what the item would inherit anyway (the
 * assigned preset's value, else the base) — so toggling back and forth doesn't
 * leave the item "customized".
 */
export function buildItemOverrideView(data: OverrideData, itemId: number, modifierId: number) {
  const resolved = new Map(
    resolveItemModifierOptions(data, itemId, modifierId).map((r) => [r.mmo.modifierOptionId, r]),
  );
  const presetId = getItemModifierConfig(data.itemModifierConfigs, itemId, modifierId)?.presetId ?? null;
  const preset = presetId != null
    ? data.modifierPresets.find((p) => p.id === presetId && p.modifierId === modifierId)
    : undefined;
  const inherited = (r: ResolvedOption) => {
    const p = preset?.overrides.find((o) => o.modifierOptionId === r.mmo.modifierOptionId);
    return { hidden: p?.hidden ?? false, price: p?.price ?? r.basePrice };
  };
  return {
    resolved,
    preset,
    inheritedPrice: (r: ResolvedOption) => inherited(r).price,
    hiddenPatch: (r: ResolvedOption): OptionOverridePatch => {
      const next = !r.hidden;
      return { hidden: next === inherited(r).hidden ? null : next };
    },
    pricePatch: (r: ResolvedOption, price: number): OptionOverridePatch => ({
      price: price === inherited(r).price ? null : price,
    }),
  };
}

/**
 * Drop the item's configs for modifiers whose attachment was never saved (a
 * pending addition that got discarded), plus the children reached through them —
 * unless a saved attachment on the item still reaches that child.
 */
export function dropUnsavedItemModifierConfigs(itemId: number, modifierIds: number[]): void {
  if (modifierIds.length === 0) return;
  const state = useMenuStore.getState();
  const withDescendants = (id: number) => [id, ...getModifierDescendantIds(state.modifiers, id)];
  const reachable = new Set(
    state.itemModifiers.filter((im) => im.itemId === itemId).flatMap((im) => withDescendants(im.modifierId)),
  );
  const dropped = new Set(modifierIds.flatMap(withDescendants));
  const next = state.itemModifierConfigs.filter(
    (c) => !(c.itemId === itemId && dropped.has(c.modifierId) && !reachable.has(c.modifierId)),
  );
  if (next.length !== state.itemModifierConfigs.length) useMenuStore.setState({ itemModifierConfigs: next });
}

/** Compact "14 hidden · Show" / "Hide" row under a modifier's visible options. */
export function HiddenOptionsToggle({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <EyeOff className="w-3 h-3 shrink-0" />
      <span>{count} hidden on this item</span>
      <span aria-hidden>·</span>
      <span className="text-[var(--aio-accent-text)]">{expanded ? 'Hide' : 'Show'}</span>
    </button>
  );
}

/** Tinted chip for a modifier header: the assigned preset's name, or "Custom". */
export function ItemModifierPresetChip({ itemId, modifierId }: { itemId: number; modifierId: number }) {
  const configs = useMenuStore((s) => s.itemModifierConfigs);
  const preset = useAssignedPreset(itemId, modifierId);
  const customized = isItemModifierCustomized(configs, itemId, modifierId);
  if (!preset && !customized) return null;
  const label = preset ? preset.name : 'Custom';
  const title = preset
    ? `Preset “${preset.name}”${customized ? ', customized for this item' : ''}`
    : 'Customized for this item';
  return (
    <span
      className="text-[10px] font-medium bg-[var(--aio-accent-soft)] text-[var(--aio-accent-text)] px-1.5 py-0.5 rounded min-w-[1.75rem] max-w-[7rem] truncate shrink-[3]"
      title={title}
    >
      {label}
      {preset && customized ? ' · edited' : ''}
    </span>
  );
}

/** Eye / eye-off icon button that hides or shows one option on this item. */
export function OptionHiddenToggle({
  hidden,
  optionLabel,
  onToggle,
  disabled,
}: {
  hidden: boolean;
  optionLabel: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const label = `${hidden ? 'Show' : 'Hide'} ${optionLabel} on this item`;
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={hidden}
      title={label}
      draggable={false}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={cn(
        'p-0.5 rounded shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        hidden
          ? 'text-[var(--aio-accent-text)] hover:text-foreground'
          : 'text-muted-foreground/60 hover:text-foreground',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

/**
 * Small coral marker next to a price that isn't the shared one. Filled dot = set
 * on this item (click to clear back); ring = inherited from the assigned preset.
 */
export function OptionPriceSourceMarker({
  source,
  presetName,
  inheritedPrice,
  optionLabel,
  onReset,
  disabled,
  className,
}: {
  source: ResolvedOption['priceSource'];
  presetName?: string;
  inheritedPrice: number;
  optionLabel: string;
  onReset: () => void;
  disabled?: boolean;
  /** Positioning — callers pin it to the price input's corner so it takes no row width. */
  className?: string;
}) {
  if (source === 'base') return null;
  if (source === 'preset') {
    return (
      <span
        className={cn('w-1.5 h-1.5 rounded-full border border-primary bg-surface shrink-0', className)}
        title={`From preset ${presetName ?? ''}`.trim()}
        aria-label={`Price from preset ${presetName ?? ''}`.trim()}
      />
    );
  }
  const label = `Set for this item — click to reset to $${inheritedPrice.toFixed(2)}`;
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={disabled}
      title={label}
      aria-label={`Reset ${optionLabel} price to $${inheritedPrice.toFixed(2)}`}
      className={cn('group p-0.5 shrink-0 disabled:cursor-not-allowed', className)}
    >
      <span className="block w-1.5 h-1.5 rounded-full bg-primary group-hover:ring-2 group-hover:ring-[var(--aio-accent-soft)]" />
    </button>
  );
}

/**
 * Above a modifier's options: preset picker (with "Save current as preset…"),
 * the customized-for-this-item line, and a warning when hiding options leaves
 * fewer visible than the modifier requires.
 */
export function ItemModifierCustomizeBar({
  itemId,
  modifier,
  disabledHint,
}: {
  itemId: number;
  modifier: Pick<Modifier, 'id' | 'minSelector'>;
  /** Set when overrides can't apply (the attachment is pending removal). */
  disabledHint?: string | null;
}) {
  const modifierPresets = useMenuStore((s) => s.modifierPresets);
  const itemModifierConfigs = useMenuStore((s) => s.itemModifierConfigs);
  const modifierModifierOptions = useMenuStore((s) => s.modifierModifierOptions);
  const modifierOptions = useMenuStore((s) => s.modifierOptions);
  const setItemModifierPreset = useMenuStore((s) => s.setItemModifierPreset);
  const saveItemModifierAsPreset = useMenuStore((s) => s.saveItemModifierAsPreset);
  const resetItemModifierOverrides = useMenuStore((s) => s.resetItemModifierOverrides);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  const presets = modifierPresets
    .filter((p) => p.modifierId === modifier.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const preset = useAssignedPreset(itemId, modifier.id);
  const customized = isItemModifierCustomized(itemModifierConfigs, itemId, modifier.id);
  const disabled = !!disabledHint;

  const data = { modifierModifierOptions, modifierOptions, modifierPresets, itemModifierConfigs };
  const total = modifierModifierOptions.filter((mmo) => mmo.modifierId === modifier.id).length;
  const visible = visibleItemModifierOptions(data, itemId, modifier.id).length;
  const min = modifier.minSelector || 0;
  const tooFewVisible = total > 0 && min > 0 && visible < min;

  const trimmed = name.trim();
  const duplicate = presets.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  const cancelSave = () => {
    setSaving(false);
    setName('');
  };
  const commitSave = () => {
    if (!trimmed || duplicate) return;
    saveItemModifierAsPreset(itemId, modifier.id, trimmed);
    cancelSave();
  };

  return (
    <div className="space-y-1.5 mb-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground shrink-0">Preset</span>
        <Select
          value={preset ? String(preset.id) : NONE}
          disabled={disabled}
          onValueChange={(v) => {
            if (v === SAVE_AS) {
              setSaving(true);
              return;
            }
            setItemModifierPreset(itemId, modifier.id, v === NONE ? null : Number(v));
          }}
        >
          <SelectTrigger className="h-7 px-2 text-xs flex-1 min-w-0" aria-label="Preset for this item">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} className="text-xs">None</SelectItem>
            {presets.map((p) => (
              <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={SAVE_AS} className="text-xs" disabled={!customized}>
              Save current as preset…
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {disabledHint && <p className="text-[10px] text-muted-foreground">{disabledHint}</p>}

      {saving && !disabled && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitSave();
                }
                if (e.key === 'Escape') cancelSave();
              }}
              placeholder="Preset name, e.g. Coffee"
              aria-label="New preset name"
              className="input-field flex-1 text-xs h-7 py-1"
              autoFocus
            />
            <button
              type="button"
              onClick={commitSave}
              disabled={!trimmed || duplicate}
              className="btn-add px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelSave}
              aria-label="Cancel"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {duplicate && trimmed && (
            <p className="text-[10px] text-danger">A preset with this name already exists</p>
          )}
        </div>
      )}

      {customized && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span>Customized for this item</span>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => resetItemModifierOverrides(itemId, modifier.id)}
            disabled={disabled}
            className="text-[var(--aio-accent-text)] hover:underline disabled:opacity-50"
          >
            {preset ? 'Reset to preset' : 'Reset'}
          </button>
        </p>
      )}

      {tooFewVisible && (
        <p className="text-[10px] text-danger">
          Only {visible} option{visible === 1 ? '' : 's'} visible but this modifier requires {min}
        </p>
      )}
    </div>
  );
}
