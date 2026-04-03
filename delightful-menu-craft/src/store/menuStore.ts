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
  ExcelMenuData,
  TabType, 
  ViewMode,
  AiPatch,
} from '@/types/menu';

interface MenuState {
  // UI State
  activeTab: TabType;
  viewMode: ViewMode;
  selectedMenuId: number | null;
  selectedCategoryId: number | null;
  selectedItemId: number | null;
  selectedModifierId: number | null;
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
  stations: string[]; // unique list of station IDs used across items
  
  // Actions - UI
  setActiveTab: (tab: TabType) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedMenu: (id: number | null) => void;
  setSelectedCategory: (id: number | null) => void;
  setSelectedItem: (id: number | null) => void;
  setSelectedModifier: (id: number | null) => void;
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
  addStation: (id: string) => void;
  renameStation: (oldId: string, newId: string) => void;
  deleteStation: (id: string) => void;
  assignItemToStation: (itemId: number, stationId: string) => void;
  unassignItemFromStation: (itemId: number, stationId: string) => void;
  bulkSetItemsForStation: (stationId: string, itemIds: number[]) => void;

  // Actions - AI Enhancement
  applyAiPatches: (patches: AiPatch[], newStations: string[]) => void;

  // Helper - Get next ID
  getNextId: (entity: keyof Pick<MenuState, 'menus' | 'categories' | 'items' | 'modifiers' | 'modifierOptions' | 'allergens' | 'tags'>) => number;
}

// Helper to generate next ID
const getMaxId = (items: { id: number }[]): number => {
  if (items.length === 0) return 0;
  return Math.max(...items.map(item => item.id));
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
      setActiveTab: (tab) => set({ activeTab: tab, selectedItemId: null }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSelectedMenu: (id) => set({ selectedMenuId: id, selectedCategoryId: null, selectedItemId: null }),
      setSelectedCategory: (id) => set({ selectedCategoryId: id }),
      setSelectedItem: (id) => set({ selectedItemId: id }),
      setSelectedModifier: (id) => set({ selectedModifierId: id }),
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
        // Derive stations from imported items
        const stationSet = new Set<string>();
        data.items.forEach(item => {
          if (item.stationIds) {
            item.stationIds.split(',').forEach(rawId => {
              const trimmed = rawId.trim();
              if (trimmed) stationSet.add(trimmed);
            });
          }
        });

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
          stations: Array.from(stationSet).sort(),
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
      addMenu: (menu) => set((state) => ({ menus: [...state.menus, menu] })),
      updateMenu: (id, updates) => set((state) => ({
        menus: state.menus.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      })),
      deleteMenu: (id) => set((state) => ({
        menus: state.menus.filter((m) => m.id !== id),
      })),
      
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
      deleteModifier: (id) => set((state) => ({
        modifiers: state.modifiers.filter((m) => m.id !== id),
        itemModifiers: state.itemModifiers.filter((im) => im.modifierId !== id),
        modifierModifierOptions: state.modifierModifierOptions.filter((mmo) => mmo.modifierId !== id),
      })),
      
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
      deleteAllergen: (id) => set((state) => ({
        allergens: state.allergens.filter((a) => a.id !== id),
      })),
      
      // Tag Actions
      addTag: (tag) => set((state) => ({ tags: [...state.tags, tag] })),
      updateTag: (id, updates) => set((state) => ({
        tags: state.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      })),
      deleteTag: (id) => set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
      })),

      // Station Actions
      addStation: (id) => set((state) => {
        const trimmed = id.trim();
        if (!trimmed) return state;
        if (state.stations.includes(trimmed)) return state;
        return {
          ...state,
          stations: [...state.stations, trimmed].sort(),
        };
      }),

      renameStation: (oldId, newId) => set((state) => {
        const from = oldId.trim();
        const to = newId.trim();
        if (!from || !to || from === to) return state;

        // Update stations list
        const stations = state.stations
          .map(s => (s === from ? to : s))
          .filter((s, idx, arr) => arr.indexOf(s) === idx)
          .sort();

        // Helper to replace in stationIds CSV
        const replaceInCsv = (csv: string | undefined): string => {
          if (!csv) return '';
          const parts = csv.split(',').map(p => p.trim()).filter(Boolean);
          const updated = parts.map(p => (p === from ? to : p));
          return Array.from(new Set(updated)).join(',');
        };

        const items = state.items.map(item => ({
          ...item,
          stationIds: replaceInCsv(item.stationIds),
        }));

        return { ...state, stations, items };
      }),

      deleteStation: (id) => set((state) => {
        const target = id.trim();
        if (!target) return state;

        const stations = state.stations.filter(s => s !== target);

        const items = state.items.map(item => {
          if (!item.stationIds) return item;
          const remaining = item.stationIds
            .split(',')
            .map(p => p.trim())
            .filter(p => p && p !== target);
          return {
            ...item,
            stationIds: remaining.join(','),
          };
        });

        return { ...state, stations, items };
      }),

      assignItemToStation: (itemId, stationId) => set((state) => {
        const target = stationId.trim();
        if (!target) return state;

        const items = state.items.map(item => {
          if (item.id !== itemId) return item;
          const existing = item.stationIds
            ? item.stationIds.split(',').map(p => p.trim()).filter(Boolean)
            : [];
          if (existing.includes(target)) return item;
          const updated = [...existing, target];
          return {
            ...item,
            stationIds: updated.join(','),
          };
        });

        const stations = state.stations.includes(target)
          ? state.stations
          : [...state.stations, target].sort();

        return { ...state, items, stations };
      }),

      unassignItemFromStation: (itemId, stationId) => set((state) => {
        const target = stationId.trim();
        if (!target) return state;

        const items = state.items.map(item => {
          if (item.id !== itemId || !item.stationIds) return item;
          const remaining = item.stationIds
            .split(',')
            .map(p => p.trim())
            .filter(p => p && p !== target);
          return {
            ...item,
            stationIds: remaining.join(','),
          };
        });

        return { ...state, items };
      }),

      applyAiPatches: (patches, newStations) => set((state) => {
        let items = [...state.items];
        let categories = [...state.categories];
        let stations = [...state.stations];

        // Register any new stations the AI proposed
        for (const s of newStations) {
          const trimmed = s.trim();
          if (trimmed && !stations.includes(trimmed)) {
            stations = [...stations, trimmed].sort();
          }
        }

        for (const patch of patches) {
          switch (patch.kind) {
            case 'item_rename':
              items = items.map((i) =>
                i.id === patch.entityId ? { ...i, posDisplayName: patch.to } : i,
              );
              break;
            case 'item_station': {
              const stationName = patch.to.trim();
              // Auto-register station if it doesn't exist yet
              if (stationName && !stations.includes(stationName)) {
                stations = [...stations, stationName].sort();
              }
              items = items.map((i) =>
                i.id === patch.entityId ? { ...i, stationIds: stationName } : i,
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

      bulkSetItemsForStation: (stationId, itemIds) => set((state) => {
        const target = stationId.trim();
        if (!target) return state;

        const idSet = new Set(itemIds);

        const items = state.items.map(item => {
          const current = item.stationIds
            ? item.stationIds.split(',').map(p => p.trim()).filter(Boolean)
            : [];

          const has = current.includes(target);
          const shouldHave = idSet.has(item.id);

          // If already correct, skip
          if (has === shouldHave) return item;

          let updated = current;
          if (shouldHave && !has) {
            updated = [...current, target];
          } else if (!shouldHave && has) {
            updated = current.filter(p => p !== target);
          }

          return {
            ...item,
            stationIds: updated.join(','),
          };
        });

        const anyHasStation = items.some(item =>
          item.stationIds
            ?.split(',')
            .map(p => p.trim())
            .filter(Boolean)
            .includes(target)
        );

        const stations = anyHasStation
          ? (state.stations.includes(target)
            ? state.stations
            : [...state.stations, target].sort())
          : state.stations.filter(s => s !== target);

        return { ...state, items, stations };
      }),
    }),
    {
      name: 'menu-manager-storage',
    }
  )
);
