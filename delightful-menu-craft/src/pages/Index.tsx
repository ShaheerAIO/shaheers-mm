import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { MainContent } from '@/components/layout/MainContent';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { ReadOnlyBanner } from '@/components/menu-builder/ReadOnlyBanner';
import { useMenuStore } from '@/store/menuStore';
import { useExtensionImport } from '@/hooks/useExtensionImport';
import { cn } from '@/lib/utils';

const Index = () => {
  const { activeTab } = useMenuStore();
  useExtensionImport();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <LeftSidebar />
      <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
        <ReadOnlyBanner />
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <MainContent />
          {/* Keep RightSidebar mounted across tab switches so in-progress
              ItemDetailPanel draft edits survive; hide (display:none) off the
              menu-builder tab. RightSidebar is fixed-positioned, so this takes
              no layout space when visible either. */}
          <div className={cn(activeTab !== 'menu-builder' && 'hidden')}>
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
