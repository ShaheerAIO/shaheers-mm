import { useEffect } from 'react';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { MainContent } from '@/components/layout/MainContent';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { ReadOnlyBanner } from '@/components/menu-builder/ReadOnlyBanner';
import { useMenuStore } from '@/store/menuStore';
import { useExtensionImport } from '@/hooks/useExtensionImport';
import { DEMO_MODE } from '@/lib/demo';
import { ensureDemoSeeded, resetDemo } from '@/lib/demoSeed';
import { cn } from '@/lib/utils';

const Index = () => {
  const { activeTab } = useMenuStore();
  useExtensionImport();
  useEffect(() => {
    if (DEMO_MODE) ensureDemoSeeded();
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <LeftSidebar />
      <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
        {DEMO_MODE && (
          <div className="flex items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-1.5 text-[12px] text-ink">
            <span>Demo build: grouped modifier presets. Not connected to the POS. Changes are saved only in this browser.</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset the demo? This clears your changes in this browser.')) resetDemo();
              }}
              className="shrink-0 rounded-[var(--aio-r-2)] border border-primary/40 px-2 py-0.5 font-medium text-primary hover:bg-primary/10"
            >
              Reset demo
            </button>
          </div>
        )}
        <ReadOnlyBanner />
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <MainContent />
          {/* Keep RightSidebar mounted across tab switches so in-progress
              ItemDetailPanel draft edits survive; hide (display:none) off the
              menu-builder/archive tabs. RightSidebar is fixed-positioned, so
              this takes no layout space when visible either. */}
          <div className={cn(activeTab !== 'menu-builder' && activeTab !== 'archive' && 'hidden')}>
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
