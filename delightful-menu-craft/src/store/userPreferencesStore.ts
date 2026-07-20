import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ModifierSort = 'default' | 'new-old' | 'name-asc' | 'name-desc' | 'options-desc' | 'options-asc';
type CategoryItemSort = 'manual' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';
type WorkspaceSort = 'updated' | 'name';

interface UserPreferencesState {
  modifierSort: ModifierSort;
  categoryItemSort: CategoryItemSort;
  workspaceSort: WorkspaceSort;
  setModifierSort: (v: ModifierSort) => void;
  setCategoryItemSort: (v: CategoryItemSort) => void;
  setWorkspaceSort: (v: WorkspaceSort) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      modifierSort: 'default',
      categoryItemSort: 'manual',
      workspaceSort: 'updated',
      setModifierSort: (modifierSort) => set({ modifierSort }),
      setCategoryItemSort: (categoryItemSort) => set({ categoryItemSort }),
      setWorkspaceSort: (workspaceSort) => set({ workspaceSort }),
    }),
    {
      name: 'menu-manager-user-preferences',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
