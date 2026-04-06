import { useMenuStore } from '@/store/menuStore';
import { MenuBuilderContent } from '@/components/menu-builder/MenuBuilderContent';
import { ModifierLibraryContent } from '@/components/modifier-library/ModifierLibraryContent';
import { StationsContent } from '@/components/stations/StationsContent';
import { StatsContent } from '@/components/stats/StatsContent';

export function MainContent() {
  const { activeTab } = useMenuStore();

  return (
    <main className="flex-1 min-h-0 min-w-0 overflow-hidden bg-background">
      {activeTab === 'menu-builder' && <MenuBuilderContent />}
      {activeTab === 'modifier-library' && <ModifierLibraryContent />}
      {activeTab === 'stations' && <StationsContent />}
      {activeTab === 'stats' && <StatsContent />}
    </main>
  );
}
