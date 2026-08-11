import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ModifierSort = 'default' | 'new-old' | 'name-asc' | 'name-desc' | 'options-desc' | 'options-asc';
type CategoryItemSort = 'manual' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';
type SubcategorySort = 'manual' | 'name-asc' | 'name-desc';
type WorkspaceSort = 'updated' | 'name';

interface UserPreferencesState {
  modifierSort: ModifierSort;
  categoryItemSort: CategoryItemSort;
  subcategorySort: SubcategorySort;
  workspaceSort: WorkspaceSort;
  setModifierSort: (v: ModifierSort) => void;
  setCategoryItemSort: (v: CategoryItemSort) => void;
  setSubcategorySort: (v: SubcategorySort) => void;
  setWorkspaceSort: (v: WorkspaceSort) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      modifierSort: 'default',
      categoryItemSort: 'manual',
      subcategorySort: 'manual',
      workspaceSort: 'updated',
      setModifierSort: (modifierSort) => set({ modifierSort }),
      setCategoryItemSort: (categoryItemSort) => set({ categoryItemSort }),
      setSubcategorySort: (subcategorySort) => set({ subcategorySort }),
      setWorkspaceSort: (workspaceSort) => set({ workspaceSort }),
    }),
    {
      name: 'menu-manager-user-preferences',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
