import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Menu,
  Category,
  Item,
  Modifier,
  ModifierOption,
  ModifierGroup,
  ModifierModifierOption,
  ItemModifier,
  CategoryModifierGroup,
  CategoryModifier,
  CategoryItem,
  ItemModifierGroup,
  Allergen,
  Tag,
  Station,
  ExcelMenuData,
  TabType,
  ViewMode,
  AiPatch,
} from '@/types/menu';

const parseStationIdsCsv = (csv: string | undefined): number[] => {
  if (!csv?.trim()) return [];
  return csv
    .split(',')
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
};

const serializeStationIdsCsv = (ids: number[]): string =>
  Array.from(new Set(ids))
    .sort((a, b) => a - b)
    .join(',');

const getNextStationId = (stations: Station[]): number =>
  stations.length === 0 ? 1 : Math.max(...stations.map((s) => s.id)) + 1;

/** Remove an id from comma-separated modifier id lists (nested / group refs). */
function stripModifierIdFromCommaList(list: string | undefined, removeId: number): string {
  if (!list?.trim()) return '';
  return list
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0 && n !== removeId)
    .join(',');
}

interface MenuState {
  // UI State
  activeTab: TabType;
  viewMode: ViewMode;
  selectedMenuId: number | null;
  selectedCategoryId: number | null;
  selectedItemId: number | null;
  selectedModifierId: number | null;
  editingCategoryId: number | null;
  editingMenuId: number | null;
  isDataLoaded: boolean;
  isCreatingModifier: boolean;
  isCreatingOption: boolean;
  pendingOption: {
    optionName: string;
    posDisplayName: string;
    isStockAvailable: boolean;
    isSizeModifier: boolean;
  } | null;
  
  // Data (matches Excel sheets)
  // Excel sheets
  menus: Menu[];
  categories: Category[];
  items: Item[];
  itemModifiers: ItemModifier[];
  categoryModifierGroups: CategoryModifierGroup[];
  categoryModifiers: CategoryModifier[];
  categoryItems: CategoryItem[];
  itemModifierGroups: ItemModifierGroup[];
  modifierGroups: ModifierGroup[];
  modifiers: Modifier[];
  modifierOptions: ModifierOption[];
  modifierModifierOptions: ModifierModifierOption[];
  allergens: Allergen[];
  tags: Tag[];

  // Derived / helper data (not part of Excel schema)
  stations: Station[]; // canonical station catalog
  
  // Actions - UI
  setActiveTab: (tab: TabType) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedMenu: (id: number | null) => void;
  setSelectedCategory: (id: number | null) => void;
  setSelectedItem: (id: number | null) => void;
  setSelectedModifier: (id: number | null) => void;
  setEditingCategory: (id: number | null) => void;
  setEditingMenu: (id: number | null) => void;
  setIsCreatingModifier: (value: boolean) => void;
  setIsCreatingOption: (value: boolean) => void;
  setPendingOption: (option: { optionName: string; posDisplayName: string; isStockAvailable: boolean; isSizeModifier: boolean; } | null) => void;
  
  // Actions - Navigation (cross-tab)
  navigateToItem: (itemId: number) => void;
  navigateToModifier: (modifierId: number) => void;
  
  // Actions - Import/Export
  importData: (data: ExcelMenuData) => void;
  exportData: () => ExcelMenuData;
  clearData: () => void;
  startFresh: () => void;
  
  // Actions - Menus
  addMenu: (menu: Menu) => void;
  updateMenu: (id: number, updates: Partial<Menu>) => void;
  deleteMenu: (id: number) => void;
  
  // Actions - Categories
  addCategory: (category: Category) => void;
  updateCategory: (id: number, updates: Partial<Category>) => void;
  deleteCategory: (id: number) => void;
  
  // Actions - Items
  addItem: (item: Item) => void;
  updateItem: (id: number, updates: Partial<Item>) => void;
  deleteItem: (id: number) => void;
  
  // Actions - Modifiers
  addModifier: (modifier: Modifier) => void;
  updateModifier: (id: number, updates: Partial<Modifier>) => void;
  deleteModifier: (id: number) => void;
  
  // Actions - Modifier Options
  addModifierOption: (option: ModifierOption) => void;
  updateModifierOption: (id: number, updates: Partial<ModifierOption>) => void;
  deleteModifierOption: (id: number) => void;
  
  // Actions - Join Tables
  addItemModifier: (itemModifier: ItemModifier) => void;
  removeItemModifier: (modifierId: number, itemId: number) => void;
  addModifierModifierOption: (mmo: ModifierModifierOption) => void;
  updateModifierModifierOption: (modifierId: number, optionId: number, updates: Partial<ModifierModifierOption>) => void;
  removeModifierModifierOption: (modifierId: number, optionId: number) => void;
  
  // Actions - Category Items (for assigning items to categories)
  addCategoryItem: (categoryItem: CategoryItem) => void;
  removeCategoryItem: (id: number) => void;
  
  // Actions - Allergens & Tags
  addAllergen: (allergen: Allergen) => void;
  updateAllergen: (id: number, updates: Partial<Allergen>) => void;
  deleteAllergen: (id: number) => void;
  addTag: (tag: Tag) => void;
  updateTag: (id: number, updates: Partial<Tag>) => void;
  deleteTag: (id: number) => void;
  
  // Actions - Stations
  addStation: (name?: string) => number;
  renameStation: (id: number, newName: string) => void;
  deleteStation: (id: number) => void;
  assignItemToStation: (itemId: number, stationId: number) => void;
  unassignItemFromStation: (itemId: number, stationId: number) => void;
  bulkSetItemsForStation: (stationId: number, itemIds: number[]) => void;

  // Actions - AI Enhancement
  applyAiPatches: (patches: AiPatch[], newStations: string[]) => void;

  // Actions - Bulk Item Update
  bulkUpdateItems: (ids: number[], transform: (item: Item) => Partial<Item>) => void;

  // Helper - Get next ID
  getNextId: (entity: keyof Pick<MenuState, 'menus' | 'categories' | 'items' | 'modifiers' | 'modifierOptions' | 'allergens' | 'tags'>) => number;
}

// Helper to generate next ID
const getMaxId = (items: { id: number }[]): number => {
  if (items.length === 0) return 0;
  return Math.max(...items.map(item => item.id));
};

/** When a category is removed, subcategories that pointed at it must go too. */
const expandCategoryDescendants = (rootIds: number[], categories: Category[]): Set<number> => {
  const set = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories) {
      if (c.parentCategoryId != null && set.has(c.parentCategoryId) && !set.has(c.id)) {
        set.add(c.id);
        changed = true;
      }
    }
  }
  return set;
};

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      // Initial UI State
      activeTab: 'menu-builder',
      viewMode: 'tree',
      selectedMenuId: null,
      selectedCategoryId: null,
      selectedItemId: null,
      selectedModifierId: null,
      editingCategoryId: null,
      editingMenuId: null,
      isDataLoaded: false,
      isCreatingModifier: false,
      isCreatingOption: false,
      pendingOption: null,
      
      // Initial Data (empty - will be populated from Excel import)
      menus: [],
      categories: [],
      items: [],
      itemModifiers: [],
      categoryModifierGroups: [],
      categoryModifiers: [],
      categoryItems: [],
      itemModifierGroups: [],
      modifierGroups: [],
      modifiers: [],
      modifierOptions: [],
      modifierModifierOptions: [],
      allergens: [],
      tags: [],
      stations: [],

      // UI Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setViewMode: (mode) =>
        set(
          mode === 'pos-preview'
            ? {
                viewMode: mode,
                selectedModifierId: null,
                isCreatingModifier: false,
                isCreatingOption: false,
              }
            : { viewMode: mode },
        ),
      setSelectedMenu: (id) => set({ selectedMenuId: id, selectedCategoryId: null, selectedItemId: null }),
      setSelectedCategory: (id) => set({ selectedCategoryId: id }),
      setSelectedItem: (id) => set({ selectedItemId: id, editingCategoryId: null, editingMenuId: null }),
      setSelectedModifier: (id) => set({ selectedModifierId: id }),
      setEditingCategory: (id) => set({ editingCategoryId: id, selectedItemId: null, editingMenuId: null }),
      setEditingMenu: (id) => set({ editingMenuId: id, selectedItemId: null, editingCategoryId: null }),
      setIsCreatingModifier: (value) => set({ isCreatingModifier: value }),
      setIsCreatingOption: (value) => set({ isCreatingOption: value }),
      setPendingOption: (option) => set({ pendingOption: option }),
      
      // Navigation Actions (cross-tab)
      navigateToItem: (itemId) => {
        const state = get();
        // Find which category this item belongs to
        const categoryItem = state.categoryItems.find(ci => ci.itemId === itemId);
        if (categoryItem) {
          // Find which menu this category belongs to
          const category = state.categories.find(c => c.id === categoryItem.categoryId);
          if (category?.menuIds) {
            const menuIds = category.menuIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (menuIds.length > 0) {
              set({ 
                activeTab: 'menu-builder',
                selectedMenuId: menuIds[0],
                selectedCategoryId: categoryItem.categoryId,
                selectedItemId: itemId,
              });
              return;
            }
          }
        }
        // Fallback: just switch to menu builder and select item
        set({ 
          activeTab: 'menu-builder',
          selectedItemId: itemId,
        });
      },
      navigateToModifier: (modifierId) => set({ 
        activeTab: 'modifier-library',
        selectedModifierId: modifierId,
      }),
      
      // Import/Export Actions
      importData: (data) => {
        // Derive station catalog from numeric stationIds on items
        const numericIdSet = new Set<number>();
        data.items.forEach((item) => {
          parseStationIdsCsv(item.stationIds).forEach((n) => numericIdSet.add(n));
        });
        const stations: Station[] = Array.from(numericIdSet)
          .sort((a, b) => a - b)
          .map((id) => ({ id, name: `Station ${id}` }));

        set({
          menus: data.menus,
          categories: data.categories,
          items: data.items,
          itemModifiers: data.itemModifiers,
          categoryModifierGroups: data.categoryModifierGroups,
          categoryModifiers: data.categoryModifiers,
          categoryItems: data.categoryItems,
          itemModifierGroups: data.itemModifierGroups,
          modifierGroups: data.modifierGroups,
          modifiers: data.modifiers,
          modifierOptions: data.modifierOptions,
          modifierModifierOptions: data.modifierModifierOptions,
          allergens: data.allergens,
          tags: data.tags,
          stations,
          isDataLoaded: true,
          selectedMenuId: data.menus.length > 0 ? data.menus[0].id : null,
        });
      },
      
      exportData: () => {
        const state = get();
        return {
          menus: state.menus,
          categories: state.categories,
          items: state.items,
          itemModifiers: state.itemModifiers,
          categoryModifierGroups: state.categoryModifierGroups,
          categoryModifiers: state.categoryModifiers,
          categoryItems: state.categoryItems,
          itemModifierGroups: state.itemModifierGroups,
          modifierGroups: state.modifierGroups,
          modifiers: state.modifiers,
          modifierOptions: state.modifierOptions,
          modifierModifierOptions: state.modifierModifierOptions,
          allergens: state.allergens,
          tags: state.tags,
        };
      },
      
      clearData: () => set({
        menus: [],
        categories: [],
        items: [],
        itemModifiers: [],
        categoryModifierGroups: [],
        categoryModifiers: [],
        categoryItems: [],
        itemModifierGroups: [],
        modifierGroups: [],
        modifiers: [],
        modifierOptions: [],
        modifierModifierOptions: [],
        allergens: [],
        tags: [],
        stations: [],
        isDataLoaded: false,
        selectedMenuId: null,
        selectedCategoryId: null,
        selectedItemId: null,
        selectedModifierId: null,
      }),
      
      startFresh: () => set({
        menus: [{
          id: 1,
          menuName: 'Main Menu',
          posDisplayName: 'Main',
          posButtonColor: '#f97316',
          picture: '',
          sortOrder: 1,
        }],
        categories: [],
        items: [],
        itemModifiers: [],
        categoryModifierGroups: [],
        categoryModifiers: [],
        categoryItems: [],
        itemModifierGroups: [],
        modifierGroups: [],
        modifiers: [],
        modifierOptions: [],
        modifierModifierOptions: [],
        allergens: [],
        tags: [],
        stations: [],
        isDataLoaded: true,
        selectedMenuId: 1,
        selectedCategoryId: null,
        selectedItemId: null,
        selectedModifierId: null,
      }),
      
      // Helper - Get next ID
      getNextId: (entity) => {
        const state = get();
        return getMaxId(state[entity] as { id: number }[]) + 1;
      },
      
      // Menu Actions
      addMenu: (menu) =>
        set((state) => ({
          menus: [...state.menus, menu],
          isDataLoaded: true,
        })),
      updateMenu: (id, updates) => set((state) => ({
        menus: state.menus.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      })),
      deleteMenu: (menuId) =>
        set((state) => {
          const parseMenuIds = (csv: string | undefined) =>
            csv?.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n)) ?? [];

          const deletedCategoryIds: number[] = [];
          const categoriesResult: Category[] = [];

          for (const c of state.categories) {
            const ids = parseMenuIds(c.menuIds);
            if (!ids.includes(menuId)) {
              categoriesResult.push(c);
              continue;
            }
            const remaining = ids.filter((id) => id !== menuId);
            if (remaining.length === 0) {
              deletedCategoryIds.push(c.id);
            } else {
              categoriesResult.push({ ...c, menuIds: remaining.join(',') });
            }
          }

          const deletedSet = expandCategoryDescendants(deletedCategoryIds, state.categories);
          const categoriesFinal = categoriesResult.filter((c) => !deletedSet.has(c.id));

          const nextMenus = state.menus.filter((m) => m.id !== menuId);

          let selectedMenuId = state.selectedMenuId;
          if (selectedMenuId === menuId) {
            selectedMenuId = nextMenus.length > 0 ? nextMenus[0].id : null;
          }

          let selectedCategoryId = state.selectedCategoryId;
          if (selectedCategoryId != null && deletedSet.has(selectedCategoryId)) {
            selectedCategoryId = null;
          }

          return {
            menus: nextMenus,
            categories: categoriesFinal,
            categoryItems: state.categoryItems.filter((ci) => !deletedSet.has(ci.categoryId)),
            categoryModifierGroups: state.categoryModifierGroups.filter(
              (g) => !deletedSet.has(g.categoryId),
            ),
            selectedMenuId,
            selectedCategoryId,
            selectedItemId: state.selectedItemId,
          };
        }),
      
      // Category Actions
      addCategory: (category) => set((state) => ({ 
        categories: [...state.categories, category],
      })),
      updateCategory: (id, updates) => set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      })),
      deleteCategory: (id) => set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
        categoryItems: state.categoryItems.filter((ci) => ci.categoryId !== id),
      })),
      
      // Item Actions
      addItem: (item) => set((state) => ({ 
        items: [...state.items, item],
      })),
      updateItem: (id, updates) => set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
      })),
      deleteItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id),
        itemModifiers: state.itemModifiers.filter((im) => im.itemId !== id),
        categoryItems: state.categoryItems.filter((ci) => ci.itemId !== id),
      })),
      
      // Modifier Actions
      addModifier: (modifier) => set((state) => ({ 
        modifiers: [...state.modifiers, modifier],
      })),
      updateModifier: (id, updates) => set((state) => ({
        modifiers: state.modifiers.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      })),
      deleteModifier: (id) =>
        set((state) => {
          const strip = (s: string | undefined) => stripModifierIdFromCommaList(s, id);
          const modifiers = state.modifiers
            .filter((m) => m.id !== id)
            .map((m) => {
              const modifierIds = strip(m.modifierIds);
              const parentModifierId = m.parentModifierId === id ? 0 : m.parentModifierId;
              return {
                ...m,
                modifierIds,
                parentModifierId,
                isNested: parentModifierId > 0 ? m.isNested : false,
                addNested: modifierIds.length > 0,
              };
            });
          return {
            modifiers,
            itemModifiers: state.itemModifiers.filter((im) => im.modifierId !== id),
            modifierModifierOptions: state.modifierModifierOptions.filter(
              (mmo) => mmo.modifierId !== id,
            ),
            itemModifierGroups: state.itemModifierGroups.filter((g) => g.modifierId !== id),
            modifierGroups: state.modifierGroups.map((mg) => ({
              ...mg,
              modifierIds: strip(mg.modifierIds),
            })),
            selectedModifierId:
              state.selectedModifierId === id ? null : state.selectedModifierId,
          };
        }),
      
      // Modifier Option Actions
      addModifierOption: (option) => set((state) => ({ modifierOptions: [...state.modifierOptions, option] })),
      updateModifierOption: (id, updates) => set((state) => ({
        modifierOptions: state.modifierOptions.map((o) => (o.id === id ? { ...o, ...updates } : o)),
      })),
      deleteModifierOption: (id) => set((state) => ({
        modifierOptions: state.modifierOptions.filter((o) => o.id !== id),
        modifierModifierOptions: state.modifierModifierOptions.filter((mmo) => mmo.modifierOptionId !== id),
      })),
      
      // Join Table Actions - Item Modifiers
      addItemModifier: (itemModifier) => set((state) => ({ 
        itemModifiers: [...state.itemModifiers, itemModifier] 
      })),
      removeItemModifier: (modifierId, itemId) => set((state) => ({
        itemModifiers: state.itemModifiers.filter(
          (im) => !(im.modifierId === modifierId && im.itemId === itemId)
        ),
      })),
      
      // Join Table Actions - Modifier Modifier Options
      addModifierModifierOption: (mmo) => set((state) => ({ 
        modifierModifierOptions: [...state.modifierModifierOptions, mmo] 
      })),
      updateModifierModifierOption: (modifierId, optionId, updates) => set((state) => ({
        modifierModifierOptions: state.modifierModifierOptions.map((mmo) => 
          (mmo.modifierId === modifierId && mmo.modifierOptionId === optionId) 
            ? { ...mmo, ...updates } 
            : mmo
        ),
      })),
      removeModifierModifierOption: (modifierId, optionId) => set((state) => ({
        modifierModifierOptions: state.modifierModifierOptions.filter(
          (mmo) => !(mmo.modifierId === modifierId && mmo.modifierOptionId === optionId)
        ),
      })),
      
      // Category Items Actions
      addCategoryItem: (categoryItem) => set((state) => ({ 
        categoryItems: [...state.categoryItems, categoryItem] 
      })),
      removeCategoryItem: (id) => set((state) => ({
        categoryItems: state.categoryItems.filter((ci) => ci.id !== id),
      })),
      
      // Allergen Actions
      addAllergen: (allergen) => set((state) => ({ allergens: [...state.allergens, allergen] })),
      updateAllergen: (id, updates) => set((state) => ({
        allergens: state.allergens.map((a) => (a.id === id ? { ...a, ...updates } : a)),
      })),
      deleteAllergen: (id) => set((state) => {
        const idStr = String(id);
        return {
          allergens: state.allergens.filter((a) => a.id !== id),
          items: state.items.map((item) => ({
            ...item,
            allergenIds: item.allergenIds
              ? item.allergenIds.split(',').map((s) => s.trim()).filter((s) => s !== idStr).join(',')
              : item.allergenIds,
          })),
        };
      }),

      // Tag Actions
      addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
      updateTag: (id, updates) => set((state) => ({
        tags: state.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      })),
      deleteTag: (id) => set((state) => {
        const idStr = String(id);
        return {
          tags: state.tags.filter((t) => t.id !== id),
          items: state.items.map((item) => ({
            ...item,
            tagIds: item.tagIds
              ? item.tagIds.split(',').map((s) => s.trim()).filter((s) => s !== idStr).join(',')
              : item.tagIds,
          })),
          categories: state.categories.map((cat) => ({
            ...cat,
            tagIds: cat.tagIds
              ? cat.tagIds.split(',').map((s) => s.trim()).filter((s) => s !== idStr).join(',')
              : cat.tagIds,
          })),
        };
      }),

      // Station Actions
      addStation: (name) => {
        const state = get();
        const id = getNextStationId(state.stations);
        const stationName = name?.trim() || `Station ${id}`;
        set((s) => ({
          stations: [...s.stations, { id, name: stationName }].sort((a, b) => a.id - b.id),
        }));
        return id;
      },

      renameStation: (id, newName) => set((state) => {
        const name = newName.trim();
        if (!name) return state;
        return {
          stations: state.stations.map((s) => (s.id === id ? { ...s, name } : s)),
        };
      }),

      deleteStation: (id) => set((state) => ({
        stations: state.stations.filter((s) => s.id !== id),
        items: state.items.map((item) => {
          const remaining = parseStationIdsCsv(item.stationIds).filter((n) => n !== id);
          return { ...item, stationIds: serializeStationIdsCsv(remaining) };
        }),
      })),

      assignItemToStation: (itemId, stationId) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id !== itemId) return item;
          const existing = parseStationIdsCsv(item.stationIds);
          if (existing.includes(stationId)) return item;
          return { ...item, stationIds: serializeStationIdsCsv([...existing, stationId]) };
        }),
      })),

      unassignItemFromStation: (itemId, stationId) => set((state) => ({
        items: state.items.map((item) => {
          if (item.id !== itemId) return item;
          const remaining = parseStationIdsCsv(item.stationIds).filter((n) => n !== stationId);
          return { ...item, stationIds: serializeStationIdsCsv(remaining) };
        }),
      })),

      applyAiPatches: (patches, newStations) => set((state) => {
        let items = [...state.items];
        let categories = [...state.categories];
        let stations = [...state.stations];

        const resolveOrCreateStation = (name: string): number => {
          const found = stations.find((s) => s.name.toLowerCase() === name.toLowerCase());
          if (found) return found.id;
          const id = getNextStationId(stations);
          stations = [...stations, { id, name }].sort((a, b) => a.id - b.id);
          return id;
        };

        // Pre-register new stations the AI proposed
        for (const s of newStations) {
          const trimmed = s.trim();
          if (trimmed) resolveOrCreateStation(trimmed);
        }

        for (const patch of patches) {
          switch (patch.kind) {
            case 'item_rename':
              items = items.map((i) =>
                i.id === patch.entityId ? { ...i, posDisplayName: patch.to } : i,
              );
              break;
            case 'item_station': {
              const stationId = resolveOrCreateStation(patch.to.trim());
              items = items.map((i) =>
                i.id === patch.entityId
                  ? { ...i, stationIds: serializeStationIdsCsv([stationId]) }
                  : i,
              );
              break;
            }
            case 'item_description':
              items = items.map((i) =>
                i.id === patch.entityId ? { ...i, itemDescription: patch.to } : i,
              );
              break;
            case 'category_rename':
              categories = categories.map((c) =>
                c.id === patch.entityId ? { ...c, posDisplayName: patch.to } : c,
              );
              break;
          }
        }

        return { items, categories, stations };
      }),

      bulkUpdateItems: (ids, transform) => set((state) => {
        const idSet = new Set(ids);
        return {
          items: state.items.map((item) =>
            idSet.has(item.id) ? { ...item, ...transform(item) } : item,
          ),
        };
      }),

      bulkSetItemsForStation: (stationId, itemIds) => set((state) => {
        const idSet = new Set(itemIds);
        const items = state.items.map((item) => {
          const current = parseStationIdsCsv(item.stationIds);
          const has = current.includes(stationId);
          const shouldHave = idSet.has(item.id);
          if (has === shouldHave) return item;
          const updated = shouldHave
            ? [...current, stationId]
            : current.filter((n) => n !== stationId);
          return { ...item, stationIds: serializeStationIdsCsv(updated) };
        });
        return { items };
      }),

    }),
    {
      name: 'menu-manager-storage',
      version: 7,
      migrate(persisted: unknown, fromVersion: number) {
        const state = persisted as Record<string, unknown>;

        if (fromVersion < 2) {
          // Migrate items: replace old visibility + timing fields with new ones
          const { parseDaySchedules, serializeDaySchedules, defaultVisibility } =
            require('@/lib/visibility') as typeof import('@/lib/visibility');

          if (Array.isArray(state.items)) {
            state.items = (state.items as Record<string, unknown>[]).map((item) => {
              const vis = defaultVisibility();
              if (typeof item.visibilityPos === 'boolean')   vis.visibilityPos   = item.visibilityPos;
              if (typeof item.visibilityKiosk === 'boolean') vis.visibilityKiosk = item.visibilityKiosk;
              const online = typeof item.visibilityOnline === 'boolean' ? item.visibilityOnline : true;
              const third  = typeof item.visibilityThirdParty === 'boolean' ? item.visibilityThirdParty : true;
              vis.visibilityQr        = typeof item.visibilityQr        === 'boolean' ? item.visibilityQr        : online;
              vis.visibilityWebsite   = typeof item.visibilityWebsite   === 'boolean' ? item.visibilityWebsite   : online;
              vis.visibilityMobileApp = typeof item.visibilityMobileApp === 'boolean' ? item.visibilityMobileApp : online;
              vis.visibilityDoordash  = typeof item.visibilityDoordash  === 'boolean' ? item.visibilityDoordash  : third;

              const daySchedules = typeof item.daySchedules === 'string' && item.daySchedules
                ? item.daySchedules
                : serializeDaySchedules(parseDaySchedules(
                    undefined,
                    typeof item.availableDays      === 'string' ? item.availableDays      : undefined,
                    typeof item.availableTimeStart === 'string' ? item.availableTimeStart : undefined,
                    typeof item.availableTimeEnd   === 'string' ? item.availableTimeEnd   : undefined,
                  ));

              const migrated = { ...item, ...vis, daySchedules };
              delete migrated.visibilityOnline;
              delete migrated.visibilityThirdParty;
              delete migrated.availableDays;
              delete migrated.availableTimeStart;
              delete migrated.availableTimeEnd;
              return migrated;
            });
          }

          if (Array.isArray(state.modifiers)) {
            const { defaultVisibility: dv } = require('@/lib/visibility') as typeof import('@/lib/visibility');
            state.modifiers = (state.modifiers as Record<string, unknown>[]).map((mod) => ({
              ...dv(),
              ...mod,
            }));
          }

          if (Array.isArray(state.modifierOptions)) {
            const { defaultVisibility: dv } = require('@/lib/visibility') as typeof import('@/lib/visibility');
            state.modifierOptions = (state.modifierOptions as Record<string, unknown>[]).map((opt) => ({
              ...dv(),
              ...opt,
            }));
          }
        }

        if (fromVersion < 3) {
          // Migrate stations: convert any string tokens in item.stationIds to numeric IDs
          // and build a Station[] catalog in state.stations.
          const tokenToId = new Map<string, number>();
          let nextId = 1;

          // First pass: claim IDs for already-numeric tokens
          if (Array.isArray(state.items)) {
            for (const item of state.items as Record<string, unknown>[]) {
              const csv = typeof item.stationIds === 'string' ? item.stationIds : '';
              for (const raw of csv.split(',')) {
                const token = raw.trim();
                if (!token || tokenToId.has(token)) continue;
                const n = parseInt(token, 10);
                if (!isNaN(n) && n > 0 && String(n) === token) {
                  tokenToId.set(token, n);
                  if (n >= nextId) nextId = n + 1;
                }
              }
            }
          }

          // Second pass: assign new IDs to non-numeric tokens
          if (Array.isArray(state.items)) {
            for (const item of state.items as Record<string, unknown>[]) {
              const csv = typeof item.stationIds === 'string' ? item.stationIds : '';
              for (const raw of csv.split(',')) {
                const token = raw.trim();
                if (!token || tokenToId.has(token)) continue;
                tokenToId.set(token, nextId++);
              }
            }
          }

          // Build Station catalog
          const stationCatalog: Array<{ id: number; name: string }> = [];
          tokenToId.forEach((numId, token) => {
            const n = parseInt(token, 10);
            const isNumeric = !isNaN(n) && String(n) === token;
            stationCatalog.push({ id: numId, name: isNumeric ? `Station ${numId}` : token });
          });
          stationCatalog.sort((a, b) => a.id - b.id);
          state.stations = stationCatalog;

          // Rewrite item stationIds to numeric CSV
          if (Array.isArray(state.items)) {
            state.items = (state.items as Record<string, unknown>[]).map((item) => {
              const csv = typeof item.stationIds === 'string' ? item.stationIds : '';
              if (!csv.trim()) return item;
              const numericIds = Array.from(
                new Set(
                  csv.split(',')
                    .map((r) => r.trim())
                    .filter(Boolean)
                    .map((t) => tokenToId.get(t))
                    .filter((n): n is number => n !== undefined),
                ),
              ).sort((a, b) => a - b);
              return { ...item, stationIds: numericIds.join(',') };
            });
          }
        }

        if (fromVersion < 4) {
          // Add maxQtyPerOption (default 1) to all ModifierModifierOption records
          if (Array.isArray(state.modifierModifierOptions)) {
            state.modifierModifierOptions = (state.modifierModifierOptions as Record<string, unknown>[]).map((mmo) => ({
              ...mmo,
              maxQtyPerOption: typeof mmo.maxQtyPerOption === 'number' ? mmo.maxQtyPerOption : 1,
            }));
          }
        }

        if (fromVersion < 5) {
          // Add visibility fields (default true) to all Category records
          if (Array.isArray(state.categories)) {
            state.categories = (state.categories as Record<string, unknown>[]).map((cat) => ({
              visibilityPos: true,
              visibilityKiosk: true,
              visibilityQr: true,
              visibilityWebsite: true,
              visibilityMobileApp: true,
              visibilityDoordash: true,
              ...cat,
            }));
          }
        }

        if (fromVersion < 6) {
          // Add daySchedules (all days enabled, no time restriction) to all Category records
          const { serializeDaySchedules, defaultDaySchedules } =
            require('@/lib/visibility') as typeof import('@/lib/visibility');
          if (Array.isArray(state.categories)) {
            state.categories = (state.categories as Record<string, unknown>[]).map((cat) => ({
              daySchedules: serializeDaySchedules(defaultDaySchedules()),
              ...cat,
            }));
          }
        }

        if (fromVersion < 7) {
          // Add visibility fields + daySchedules to all Menu records
          const { serializeDaySchedules, defaultDaySchedules } =
            require('@/lib/visibility') as typeof import('@/lib/visibility');
          if (Array.isArray(state.menus)) {
            state.menus = (state.menus as Record<string, unknown>[]).map((menu) => ({
              visibilityPos: true,
              visibilityKiosk: true,
              visibilityQr: true,
              visibilityWebsite: true,
              visibilityMobileApp: true,
              visibilityDoordash: true,
              daySchedules: serializeDaySchedules(defaultDaySchedules()),
              ...menu,
            }));
          }
        }

        return persisted as MenuState;
      },
    }
  )
);
