import type {
  ItemModifierConfig,
  Modifier,
  ModifierModifierOption,
  ModifierOption,
  ModifierPreset,
  OptionOverride,
  OptionOverridePatch,
} from '@/types/menu';

// =============================================================================
// Demo: modifier presets & per-item option overrides
//
// A separate layer over the shared ModifierModifierOption joins. Nothing here
// touches the join's maxLimit or the option's own channel visibility, and none of
// it is exported to Excel — the POS has no concept of it.
//
// Precedence per field (hidden, price): item override → preset override → base.
//
// Known limitation: configs are keyed by (itemId, modifierId). A nested child
// modifier that appears under two different parents on the same item therefore
// shares one config — overriding it under one parent overrides it under both.
// =============================================================================

export type OverrideSource = 'base' | 'preset' | 'item';

export interface ResolvedOption {
  mmo: ModifierModifierOption;
  option: ModifierOption | undefined;
  hidden: boolean;
  price: number;        // effective
  basePrice: number;    // mmo.maxLimit > 0 ? mmo.maxLimit : 0
  hiddenSource: OverrideSource;
  priceSource: OverrideSource;
}

export interface OverrideData {
  modifierModifierOptions: ModifierModifierOption[];
  modifierOptions: ModifierOption[];
  modifierPresets: ModifierPreset[];
  itemModifierConfigs: ItemModifierConfig[];
}

// --- lookups -----------------------------------------------------------------

export function getItemModifierConfig(
  configs: ItemModifierConfig[],
  itemId: number,
  modifierId: number,
): ItemModifierConfig | undefined {
  return configs.find((c) => c.itemId === itemId && c.modifierId === modifierId);
}

/** True when the item has its own overrides for this modifier (on top of any preset). */
export function isItemModifierCustomized(
  configs: ItemModifierConfig[],
  itemId: number,
  modifierId: number,
): boolean {
  const config = getItemModifierConfig(configs, itemId, modifierId);
  return !!config && config.overrides.length > 0;
}

export function getItemsUsingPreset(configs: ItemModifierConfig[], presetId: number): number[] {
  return Array.from(new Set(configs.filter((c) => c.presetId === presetId).map((c) => c.itemId)));
}

// --- resolution --------------------------------------------------------------

const byOptionId = (overrides: OptionOverride[] | undefined): Map<number, OptionOverride> =>
  new Map((overrides ?? []).map((o) => [o.modifierOptionId, o]));

function resolveLayers(
  modifierModifierOptions: ModifierModifierOption[],
  modifierOptions: ModifierOption[],
  modifierId: number,
  presetOverrides: OptionOverride[] | undefined,
  itemOverrides: OptionOverride[] | undefined,
): ResolvedOption[] {
  const presetMap = byOptionId(presetOverrides);
  const itemMap = byOptionId(itemOverrides);
  const optionById = new Map(modifierOptions.map((o) => [o.id, o]));

  return modifierModifierOptions
    .filter((mmo) => mmo.modifierId === modifierId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((mmo) => {
      const basePrice = mmo.maxLimit > 0 ? mmo.maxLimit : 0;
      const p = presetMap.get(mmo.modifierOptionId);
      const i = itemMap.get(mmo.modifierOptionId);

      let hidden = false;
      let hiddenSource: OverrideSource = 'base';
      if (i?.hidden !== undefined) { hidden = i.hidden; hiddenSource = 'item'; }
      else if (p?.hidden !== undefined) { hidden = p.hidden; hiddenSource = 'preset'; }

      let price = basePrice;
      let priceSource: OverrideSource = 'base';
      if (i?.price !== undefined) { price = i.price; priceSource = 'item'; }
      else if (p?.price !== undefined) { price = p.price; priceSource = 'preset'; }

      return {
        mmo,
        option: optionById.get(mmo.modifierOptionId),
        hidden,
        price,
        basePrice,
        hiddenSource,
        priceSource,
      };
    });
}

/** All of the modifier's options for this item, in mmo.sortOrder order; hidden ones are included and flagged. */
export function resolveItemModifierOptions(
  data: OverrideData,
  itemId: number,
  modifierId: number,
): ResolvedOption[] {
  const config = getItemModifierConfig(data.itemModifierConfigs, itemId, modifierId);
  const preset = config?.presetId != null
    ? data.modifierPresets.find((p) => p.id === config.presetId && p.modifierId === modifierId)
    : undefined;
  return resolveLayers(
    data.modifierModifierOptions,
    data.modifierOptions,
    modifierId,
    preset?.overrides,
    config?.overrides,
  );
}

export function visibleItemModifierOptions(
  data: OverrideData,
  itemId: number,
  modifierId: number,
): ResolvedOption[] {
  return resolveItemModifierOptions(data, itemId, modifierId).filter((r) => !r.hidden);
}

/** The preset layer alone over the base (no item overrides). Empty when the preset doesn't exist. */
export function resolvePresetOptions(
  data: Omit<OverrideData, 'itemModifierConfigs'>,
  presetId: number,
): ResolvedOption[] {
  const preset = data.modifierPresets.find((p) => p.id === presetId);
  if (!preset) return [];
  return resolveLayers(
    data.modifierModifierOptions,
    data.modifierOptions,
    preset.modifierId,
    preset.overrides,
    undefined,
  );
}

// --- override list helpers ---------------------------------------------------

const isEmptyOverride = (o: OptionOverride): boolean =>
  o.hidden === undefined && o.price === undefined;

/** Drop overrides that set nothing; collapse duplicates for one option (later wins per field). */
export function normalizeOverrides(overrides: OptionOverride[]): OptionOverride[] {
  return mergeOverrides([], overrides);
}

/** Union by option; `top` wins per field. Overrides that end up setting nothing are removed. */
export function mergeOverrides(base: OptionOverride[], top: OptionOverride[]): OptionOverride[] {
  const merged = new Map<number, OptionOverride>();
  for (const o of [...base, ...top]) {
    const prev = merged.get(o.modifierOptionId);
    const next: OptionOverride = { modifierOptionId: o.modifierOptionId };
    const hidden = o.hidden !== undefined ? o.hidden : prev?.hidden;
    const price = o.price !== undefined ? o.price : prev?.price;
    if (hidden !== undefined) next.hidden = hidden;
    if (price !== undefined) next.price = price;
    merged.set(o.modifierOptionId, next);
  }
  return Array.from(merged.values()).filter((o) => !isEmptyOverride(o));
}

/** Apply a patch to one option's override: null clears a field, undefined leaves it. */
export function applyOverridePatch(
  overrides: OptionOverride[],
  modifierOptionId: number,
  patch: OptionOverridePatch,
): OptionOverride[] {
  const current = overrides.find((o) => o.modifierOptionId === modifierOptionId);
  const next: OptionOverride = { modifierOptionId };
  const hidden = patch.hidden === undefined ? current?.hidden : patch.hidden ?? undefined;
  const price = patch.price === undefined ? current?.price : patch.price ?? undefined;
  if (hidden !== undefined) next.hidden = hidden;
  if (price !== undefined) next.price = price;

  const rest = overrides.filter((o) => o.modifierOptionId !== modifierOptionId);
  if (isEmptyOverride(next)) return rest;
  // Keep the option's position in the list when it already had an override.
  const idx = overrides.findIndex((o) => o.modifierOptionId === modifierOptionId);
  if (idx === -1) return [...rest, next];
  const out = [...overrides];
  out[idx] = next;
  return out;
}

/** Strip one option from an override list (returns the same reference when it wasn't there). */
export function stripOptionFromOverrides(overrides: OptionOverride[], modifierOptionId: number): OptionOverride[] {
  return overrides.some((o) => o.modifierOptionId === modifierOptionId)
    ? overrides.filter((o) => o.modifierOptionId !== modifierOptionId)
    : overrides;
}

// --- config list helpers -----------------------------------------------------

/** A config that points at no preset and has no overrides carries nothing — drop it. */
export const normalizeConfigs = (configs: ItemModifierConfig[]): ItemModifierConfig[] =>
  configs.filter((c) => c.presetId !== null || c.overrides.length > 0);

/**
 * Create-or-update the (item, modifier) config through `fn`, then normalize.
 * Always returns a new array.
 */
export function upsertItemModifierConfig(
  configs: ItemModifierConfig[],
  itemId: number,
  modifierId: number,
  fn: (config: ItemModifierConfig) => ItemModifierConfig,
): ItemModifierConfig[] {
  const idx = configs.findIndex((c) => c.itemId === itemId && c.modifierId === modifierId);
  const current: ItemModifierConfig =
    idx === -1 ? { itemId, modifierId, presetId: null, overrides: [] } : configs[idx];
  const updated = fn(current);
  const next = idx === -1 ? [...configs, updated] : configs.map((c, i) => (i === idx ? updated : c));
  return normalizeConfigs(next);
}

// --- nesting -----------------------------------------------------------------

const parseIdList = (csv: string | undefined): number[] =>
  String(csv || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

/**
 * Every modifier nested (at any depth) under `rootId`, resolved the same way as
 * buildModifierNesting: a parent's own `modifierIds` when it names existing
 * modifiers, otherwise the modifiers whose `parentModifierId` points at it.
 * Cycle-safe; never includes `rootId` itself.
 */
export function getModifierDescendantIds(modifiers: readonly Modifier[], rootId: number): Set<number> {
  const ids = new Set(modifiers.map((m) => m.id));
  const childrenOf = (id: number): number[] => {
    const m = modifiers.find((x) => x.id === id);
    if (!m) return [];
    const listed = parseIdList(m.modifierIds).filter((c) => c !== id && ids.has(c));
    return listed.length > 0
      ? listed
      : modifiers.filter((c) => c.id !== id && c.parentModifierId === id).map((c) => c.id);
  };
  const out = new Set<number>();
  const stack = childrenOf(rootId);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === rootId || out.has(id)) continue;
    out.add(id);
    stack.push(...childrenOf(id));
  }
  return out;
}
