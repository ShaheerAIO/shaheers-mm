import { useMenuStore } from '@/store/menuStore';
import { TopBar } from './TopBar';
import { CategoryColumns } from './CategoryColumns';
import { POSPreview } from './POSPreview';

export function MenuBuilderContent() {
  const { viewMode } = useMenuStore();

  return (
    <div className="flex flex-col h-full">
      <TopBar />
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'tree' ? <CategoryColumns /> : <POSPreview />}
      </div>
    </div>
  );
}
