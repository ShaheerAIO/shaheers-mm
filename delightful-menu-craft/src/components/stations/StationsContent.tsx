import { useMemo } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Upload, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StationsContent() {
  const { items, isDataLoaded } = useMenuStore();

  // Extract unique station IDs from all items
  const stations = useMemo(() => {
    const stationSet = new Set<string>();
    items.forEach(item => {
      if (item.stationIds) {
        item.stationIds.split(',').forEach(id => {
          const trimmed = id.trim();
          if (trimmed) stationSet.add(trimmed);
        });
      }
    });
    return Array.from(stationSet).sort();
  }, [items]);

  // Get items by station
  const getItemsByStation = (stationId: string) => {
    return items.filter(item => 
      item.stationIds?.split(',').map(s => s.trim()).includes(stationId)
    );
  };

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Data Loaded</h3>
          <p className="text-sm text-muted-foreground">
            Import an Excel file to view stations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Stations</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Stations are defined by the <code className="bg-muted px-1 rounded">stationIds</code> field on items. 
        Items can be assigned to multiple stations.
      </p>

      {stations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((stationId) => {
            const stationItems = getItemsByStation(stationId);
            return (
              <div
                key={stationId}
                className={cn(
                  "p-4 bg-card rounded-lg border border-border",
                  "hover:border-primary/50 transition-colors"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Station {stationId}</span>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {stationItems.length} items assigned
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {stationItems.slice(0, 5).map(item => (
                    <div key={item.id} className="text-xs text-muted-foreground truncate">
                      • {item.itemName}
                    </div>
                  ))}
                  {stationItems.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      ... and {stationItems.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No stations found in the data</p>
          <p className="text-sm mt-1">
            Assign station IDs to items to see them here
          </p>
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Note: To modify stations, edit the <code className="bg-muted px-1 rounded">stationIds</code> field 
        on individual items. Printer mapping is configured in the Prod Ops dashboard.
      </p>
    </div>
  );
}
