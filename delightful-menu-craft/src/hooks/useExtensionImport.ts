import { useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { mapScraperToExcelData } from '@/lib/doorDashMapper';
import type { ScraperMenuData } from '@/lib/doordashApi';

/**
 * Listens for postMessage events from the DoorDash Chrome extension's bridge
 * script. When import data arrives, maps it and loads it into the store.
 */
export function useExtensionImport() {
  const importData = useMenuStore((s) => s.importData);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'DD_EXTENSION_IMPORT') return;

      const raw = event.data.data as ScraperMenuData | undefined;
      if (!raw?.Menu || !raw?.Item) return;

      try {
        const mapped = mapScraperToExcelData(raw);
        importData(mapped);
      } catch (err) {
        console.error('[Extension Import] Mapping failed:', err);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [importData]);
}
