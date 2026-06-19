import { useMenuStore } from '@/store/menuStore';
import { TopBar } from './TopBar';
import { CategoryColumns } from './CategoryColumns';
import { POSPreview } from './POSPreview';
import { KioskPreview } from './kiosk-preview/KioskPreview';

export function MenuBuilderContent() {
  const { viewMode } = useMenuStore();

  return (
    <div className="flex min-h-0 min-w-0 h-full w-full max-w-full flex-col">
      <TopBar />
      {/* relative+absolute ensures the scroll container is exactly sized to this box */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0">
          {viewMode === 'tree' ? (
            <CategoryColumns />
          ) : viewMode === 'kiosk-preview' ? (
            <KioskPreview />
          ) : (
            <POSPreview />
          )}
        </div>
      </div>
    </div>
  );
}
