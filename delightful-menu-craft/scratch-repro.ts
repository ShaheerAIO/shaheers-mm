// Scratch script to simulate CreateModifierPanel's bulk-add + save flow directly
// against the real zustand store, bypassing React/UI, to check sortOrder behavior.

// Minimal localStorage shim for the persist middleware.
(globalThis as any).localStorage = {
  _data: {} as Record<string, string>,
  getItem(key: string) { return this._data[key] ?? null; },
  setItem(key: string, value: string) { this._data[key] = value; },
  removeItem(key: string) { delete this._data[key]; },
};

import { parseBulkOptionNames } from './src/lib/bulkOptionNames';
import { useMenuStore } from './src/store/menuStore';
import { defaultVisibility } from './src/lib/visibility';

const store = useMenuStore.getState();

// Simulate typing into the bulk textarea, in this exact order:
const bulkCreateText = 'Zebra\nApple\nMango\nBanana';
const parsed = parseBulkOptionNames(bulkCreateText);
const names = parsed.filter((n) => n.trim().length >= 2);

type OptionDraft = {
  id: string;
  type: 'new';
  optionName: string;
  posDisplayName: string;
  price: number;
  isDefaultSelected: boolean;
  maxQtyPerOption: number;
  isStockAvailable: boolean;
  isSizeModifier: boolean;
};

let options: OptionDraft[] = [];
const newDrafts: OptionDraft[] = names.map((name, i) => ({
  id: `new-bulk-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
  type: 'new' as const,
  optionName: name,
  posDisplayName: name,
  price: 0,
  isDefaultSelected: false,
  maxQtyPerOption: 1,
  isStockAvailable: true,
  isSizeModifier: false,
}));
options = [...options, ...newDrafts];

console.log('Typed order:', names);
console.log('Draft options order:', options.map((o) => o.optionName));

// Now replicate handleSave exactly.
const newModifierId = store.getNextId('modifiers');
store.addModifier({
  id: newModifierId,
  modifierName: 'Test Sizes',
  posDisplayName: 'Test Sizes',
  minSelector: 0,
  maxSelector: 1,
  noMaxSelection: false,
  isOptional: '',
  modType: 'Optional',
  onPrem: true,
  offPrem: true,
  isNested: false,
  addNested: false,
  modifierOptionPriceType: 'NoCharge',
  canGuestSelectMoreModifiers: true,
  multiSelect: false,
  limitIndividualModifierSelection: false,
  prefix: '',
  pizzaSelection: false,
  price: 0,
  parentModifierId: 0,
  modifierIds: '',
  isSizeModifier: false,
  ...defaultVisibility(),
} as any);

options.forEach((opt, index) => {
  const optionId = useMenuStore.getState().getNextId('modifierOptions');
  useMenuStore.getState().addModifierOption({
    id: optionId,
    optionName: opt.optionName,
    posDisplayName: opt.posDisplayName,
    parentModifierId: newModifierId,
    isStockAvailable: opt.isStockAvailable,
    isSizeModifier: opt.isSizeModifier,
    ...defaultVisibility(),
  } as any);

  useMenuStore.getState().addModifierModifierOption({
    modifierId: newModifierId,
    modifierOptionId: optionId,
    isDefaultSelected: opt.isDefaultSelected,
    maxLimit: opt.price,
    optionDisplayName: opt.posDisplayName.trim() || opt.optionName,
    sortOrder: index,
    maxQtyPerOption: opt.maxQtyPerOption,
  });
});

const finalState = useMenuStore.getState();
const joins = finalState.modifierModifierOptions
  .filter((mmo) => mmo.modifierId === newModifierId)
  .sort((a, b) => a.sortOrder - b.sortOrder);

console.log('\nSaved join rows (sorted by sortOrder):');
for (const j of joins) {
  const opt = finalState.modifierOptions.find((o) => o.id === j.modifierOptionId);
  console.log(`  sortOrder=${j.sortOrder} optionId=${j.modifierOptionId} name=${opt?.optionName}`);
}
