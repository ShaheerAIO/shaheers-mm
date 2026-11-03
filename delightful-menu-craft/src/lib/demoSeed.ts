import { useMenuStore } from '@/store/menuStore';
import type {
  Category, ExcelMenuData, Item, Menu, Modifier, ModifierModifierOption, ModifierOption, OptionOverride,
} from '@/types/menu';
import { defaultDaySchedules, defaultVisibility, serializeDaySchedules } from '@/lib/visibility';
import { DEFAULT_SALE_CATEGORY, DEFAULT_SALE_CATEGORY_ID } from '@/lib/saleCategories';
import { DEFAULT_CATEGORY_COLOR, DEFAULT_MENU_COLOR } from '@/lib/posColors';

const SEED_FLAG = 'mm-demo-seeded-v1';
const CATEGORY_COLOR = DEFAULT_CATEGORY_COLOR;

const DRINKS = ['Coffee', 'Latte', 'Water', 'Smoothie', 'Fresh juice'];
const FOOD = ['Pizza', 'Wings', 'Tenders', 'Sandwich', 'Salad', 'Soup'];
const ITEM_PRICES: Record<string, number> = {
  Coffee: 0, Latte: 0, Water: 0, Smoothie: 0, 'Fresh juice': 0,
  Pizza: 0, Wings: 0, Tenders: 0, Sandwich: 0, Salad: 0, Soup: 0,
};

const SIZES = [
  '12 oz', '16 oz', '20 oz', '24 oz', '32 oz', '1 Liter', 'Small', 'Medium', 'Large', 'Half', 'Whole',
  '6 pieces', '12 pieces', '18 pieces', '3 pieces', '5 pieces', '8 pieces', 'Cup', 'Bowl',
];

// preset name -> [items it applies to, [size, price][]]
const PRESETS: [string, string[], [string, number][]][] = [
  ['Coffee', ['Coffee'], [['12 oz', 3], ['16 oz', 3.5], ['20 oz', 4]]],
  ['Latte', ['Latte'], [['12 oz', 4.25], ['16 oz', 4.75], ['24 oz', 5.5]]],
  ['Water', ['Water'], [['16 oz', 1.5], ['20 oz', 2], ['1 Liter', 3]]],
  ['Smoothies', ['Smoothie'], [['16 oz', 6], ['24 oz', 7.5], ['32 oz', 9]]],
  ['Fresh juice', ['Fresh juice'], [['12 oz', 5], ['16 oz', 6], ['20 oz', 7]]],
  ['Pizza', ['Pizza'], [['Small', 10], ['Medium', 14], ['Large', 18]]],
  ['Wings', ['Wings'], [['6 pieces', 8], ['12 pieces', 15], ['18 pieces', 21]]],
  ['Tenders', ['Tenders'], [['3 pieces', 7], ['5 pieces', 10], ['8 pieces', 14]]],
  ['Sandwiches', ['Sandwich'], [['Half', 6], ['Whole', 10]]],
  ['Salad', ['Salad'], [['Small', 7], ['Large', 11]]],
  ['Soup', ['Soup'], [['Cup', 4], ['Bowl', 6]]],
];

export function loadDemoSeed(): void {
  const vis = defaultVisibility();
  const days = serializeDaySchedules(defaultDaySchedules());

  const menu: Menu = {
    id: 1, menuName: 'Main Menu', posDisplayName: 'Main Menu', posButtonColor: DEFAULT_MENU_COLOR,
    picture: '', sortOrder: 1, ...vis, daySchedules: days,
  };

  const mkCategory = (id: number, name: string, sortOrder: number): Category => ({
    id, categoryName: name, posDisplayName: name, kdsDisplayName: name, color: CATEGORY_COLOR,
    image: '', kioskImage: '', parentCategoryId: null, tagIds: '', menuIds: '1', sortOrder,
    ...vis, daySchedules: days,
  });
  const categories = [mkCategory(1, 'Drinks', 1), mkCategory(2, 'Food', 2)];

  const items: Item[] = [];
  const categoryItems: ExcelMenuData['categoryItems'] = [];
  const itemId: Record<string, number> = {};
  [[1, DRINKS], [2, FOOD]].forEach(([catId, names]) => {
    (names as string[]).forEach((name, idx) => {
      const id = items.length + 1;
      itemId[name] = id;
      items.push({
        id, itemName: name, posDisplayName: name, kdsName: name, itemDescription: '',
        itemPicture: '', onlineImage: '', landscapeImage: '', thirdPartyImage: '', kioskItemImage: '',
        itemPrice: ITEM_PRICES[name] ?? 0,
        taxLinkedWithParentSetting: true, calculatePricesWithTaxIncluded: false, salesTax: true,
        takeoutException: false, stockStatus: 'inStock', stockValue: 0, orderQuantityLimit: true,
        minLimit: 1, maxLimit: 1, noMaxLimit: true, stationIds: '', preparationTime: null, calories: null,
        tagIds: '', inheritTagsFromCategory: true,
        saleCategory: DEFAULT_SALE_CATEGORY, saleCategoryId: DEFAULT_SALE_CATEGORY_ID,
        allergenIds: '', inheritModifiersFromCategory: true, addonIds: '', isSpecialRequest: true,
        doordashPrice: 0, uberEatsPrice: 0, grubHubPrice: 0,
        ...vis, inheritVisibilityFromCategory: true, daySchedules: days,
      });
      categoryItems.push({ id: id, categoryId: catId as number, itemId: id, sortOrder: idx + 1 });
    });
  });

  // Modifiers: 1 Size Choice, 2 Coffee extras (parent), 3 Milk choice (nested child of 2)
  const mkModifier = (
    id: number, name: string, over: Partial<Modifier>,
  ): Modifier => ({
    id, modifierName: name, posDisplayName: name, isNested: false, addNested: false,
    modifierOptionPriceType: 'Individual', isOptional: 'Select any', canGuestSelectMoreModifiers: false,
    multiSelect: false, limitIndividualModifierSelection: false, minSelector: 0, maxSelector: 1,
    noMaxSelection: false, prefix: '', pizzaSelection: false, price: 0, parentModifierId: 0,
    offPrem: true, modifierIds: '', isSizeModifier: false, onPrem: true, ...vis, ...over,
  });
  const modifiers: Modifier[] = [
    mkModifier(1, 'Size Choice', {
      isOptional: 'Required', modType: 'Required', minSelector: 1, maxSelector: 1, isSizeModifier: true,
    }),
    mkModifier(2, 'Coffee extras', {
      modType: 'Optional', multiSelect: true, maxSelector: 2, addNested: true, modifierIds: '3',
    }),
    mkModifier(3, 'Milk choice', {
      modType: 'Optional', isNested: true, parentModifierId: 2,
    }),
  ];

  const modifierOptions: ModifierOption[] = [];
  const modifierModifierOptions: ModifierModifierOption[] = [];
  const optId: Record<string, number> = {};
  const addOption = (modifierId: number, name: string, price: number, key: string, sortOrder: number) => {
    const id = modifierOptions.length + 1;
    optId[key] = id;
    modifierOptions.push({
      id, optionName: name, posDisplayName: name, parentModifierId: modifierId,
      isStockAvailable: true, isSizeModifier: modifierId === 1, ...vis,
    });
    modifierModifierOptions.push({
      modifierId, modifierOptionId: id, isDefaultSelected: false, maxLimit: price,
      optionDisplayName: name, sortOrder, maxQtyPerOption: 1,
    });
  };
  SIZES.forEach((s, i) => addOption(1, s, 0, `size:${s}`, i + 1));
  addOption(2, 'Extra shot', 1, 'extra:shot', 1);
  addOption(2, 'Vanilla syrup', 0.75, 'extra:vanilla', 2);
  ([['Whole milk', 0], ['Oat milk', 0.75], ['Almond milk', 0.75], ['Soy milk', 0.5]] as [string, number][])
    .forEach(([n, p], i) => addOption(3, n, p, `milk:${n}`, i + 1));

  useMenuStore.getState().importData({
    menus: [menu], categories, items,
    itemModifiers: [], categoryModifierGroups: [], categoryModifiers: [], categoryItems,
    itemModifierGroups: [], modifierGroups: [], modifiers, modifierOptions, modifierModifierOptions,
    allergens: [], tags: [],
  });

  const st = () => useMenuStore.getState();
  for (const [name, itemNames, prices] of PRESETS) {
    const visible = new Map(prices.map(([s, p]) => [`size:${s}`, p]));
    const overrides: OptionOverride[] = SIZES.map((s) => {
      const key = `size:${s}`;
      return visible.has(key)
        ? { modifierOptionId: optId[key], hidden: false, price: visible.get(key) }
        : { modifierOptionId: optId[key], hidden: true };
    });
    const presetId = st().createModifierPreset(1, name, overrides);
    st().applyPresetToItems(presetId, itemNames.map((n) => itemId[n]));
  }

  // Coffee extras on Coffee and Latte (top-level attach; Milk choice is reached through it)
  const attach = (name: string, modifierId: number) => {
    const sortOrder = st().itemModifiers.filter((im) => im.itemId === itemId[name]).length;
    useMenuStore.setState((s) => ({
      itemModifiers: [...s.itemModifiers, { itemId: itemId[name], modifierId, sortOrder }],
    }));
  };
  attach('Coffee', 2);
  attach('Latte', 2);

  st().setItemOptionOverride(itemId['Latte'], 3, optId['milk:Soy milk'], { hidden: true });
  st().setItemOptionOverride(itemId['Soup'], 1, optId['size:Bowl'], { price: 6.5 });

  st().setSelectedMenu(1);
  st().setSelectedCategory(1);
}

function readFlag(): boolean | null {
  try { return localStorage.getItem(SEED_FLAG) === '1'; } catch { return null; }
}
function writeFlag(): void {
  try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
}

export function resetDemo(): void {
  useMenuStore.getState().clearData();
  loadDemoSeed();
  writeFlag();
}

export function ensureDemoSeeded(): void {
  const s = useMenuStore.getState();
  const flag = readFlag();
  if (s.items.length === 0 || flag === false) {
    loadDemoSeed();
    writeFlag();
  }
}
