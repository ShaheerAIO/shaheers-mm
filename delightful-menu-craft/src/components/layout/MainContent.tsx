import { useMenuStore } from '@/store/menuStore';
import { MenuBuilderContent } from '@/components/menu-builder/MenuBuilderContent';
import { ModifierLibraryContent } from '@/components/modifier-library/ModifierLibraryContent';
import { StationsContent } from '@/components/stations/StationsContent';
import { SettingsContent } from '@/components/settings/SettingsContent';
import { CategoriesContent } from '@/components/categories/CategoriesContent';
import { ReadOnlyFieldset } from '@/components/ReadOnlyFieldset';

export function MainContent() {
  const { activeTab } = useMenuStore();

  return (
    <main className="flex-1 min-h-0 min-w-0 overflow-hidden bg-background">
      {/* menu-builder threads read-only itself so entity selection stays live for inspection. */}
      {activeTab === 'menu-builder' && <MenuBuilderContent />}
      {activeTab === 'modifier-library' && (
        <ReadOnlyFieldset><ModifierLibraryContent /></ReadOnlyFieldset>
      )}
      {activeTab === 'stations' && (
        <ReadOnlyFieldset><StationsContent /></ReadOnlyFieldset>
      )}
      {activeTab === 'categories' && (
        <ReadOnlyFieldset><CategoriesContent /></ReadOnlyFieldset>
      )}
      {activeTab === 'settings' && (
        <ReadOnlyFieldset><SettingsContent /></ReadOnlyFieldset>
      )}
    </main>
  );
}
