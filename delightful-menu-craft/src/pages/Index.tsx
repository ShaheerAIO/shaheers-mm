import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { MainContent } from '@/components/layout/MainContent';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { useMenuStore } from '@/store/menuStore';
import { useExtensionImport } from '@/hooks/useExtensionImport';

const Index = () => {
  const { activeTab } = useMenuStore();
  useExtensionImport();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <LeftSidebar />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <MainContent />
        {activeTab === 'menu-builder' && <RightSidebar />}
      </div>
    </div>
  );
};

export default Index;
