import { useMemo, useState, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import type { Station } from '@/types/menu';
import { Upload, Radio, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

export function StationsContent() {
  const {
    items,
    stations,
    isDataLoaded,
    addStation,
    renameStation,
    deleteStation,
    bulkSetItemsForStation,
  } = useMenuStore();

  const [newStationName, setNewStationName] = useState('');
  const [stationToDelete, setStationToDelete] = useState<number | null>(null);
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [stationSelections, setStationSelections] = useState<Record<number, Set<number>>>({});
  const [itemSearch, setItemSearch] = useState('');

  // Fallback: derive stations from items if store.stations is empty
  const derivedStationsFromItems = useMemo((): Station[] => {
    const idSet = new Set<number>();
    items.forEach((item) => {
      if (item.stationIds) {
        item.stationIds
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n > 0)
          .forEach((n) => idSet.add(n));
      }
    });
    return Array.from(idSet)
      .sort((a, b) => a - b)
      .map((id) => ({ id, name: `Station ${id}` }));
  }, [items]);

  const effectiveStations: Station[] = stations.length > 0 ? stations : derivedStationsFromItems;

  const buildInitialSelections = () => {
    const map: Record<number, Set<number>> = {};
    effectiveStations.forEach((s) => {
      map[s.id] = new Set<number>();
    });
    items.forEach((item) => {
      if (!item.stationIds) return;
      item.stationIds
        .split(',')
        .map((p) => parseInt(p.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
        .forEach((n) => {
          if (!map[n]) map[n] = new Set<number>();
          map[n].add(item.id);
        });
    });
    return map;
  };

  // Re-initialize selections when the station catalog changes (add/delete station).
  // We intentionally do NOT include `items` here: saving Station A updates the store,
  // which would otherwise reset Station B's unsaved checkbox state.
  // The component unmounts when switching tabs anyway, so stale data is not a concern.
  const stationCatalogKey = effectiveStations.map((s) => s.id).join('|');
  useEffect(() => {
    setStationSelections(buildInitialSelections());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationCatalogKey]);

  const filteredItems = useMemo(() => {
    const base = [...items].sort((a, b) => a.itemName.localeCompare(b.itemName));
    const q = itemSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        item.itemName.toLowerCase().includes(q) ||
        item.posDisplayName.toLowerCase().includes(q),
    );
  }, [items, itemSearch]);

  const toggleItemForStation = (stationId: number, itemId: number) => {
    setStationSelections((prev) => {
      const currentSet = prev[stationId] ? new Set(prev[stationId]) : new Set<number>();
      if (currentSet.has(itemId)) {
        currentSet.delete(itemId);
      } else {
        currentSet.add(itemId);
      }
      return { ...prev, [stationId]: currentSet };
    });
  };

  const handleSaveStationSelection = (stationId: number) => {
    const selectedSet = stationSelections[stationId] || new Set<number>();
    bulkSetItemsForStation(stationId, Array.from(selectedSet));
  };

  const handleAddStation = () => {
    const trimmed = newStationName.trim();
    if (!trimmed) return;
    addStation(trimmed);
    setNewStationName('');
  };

  const startEditingStation = (station: Station) => {
    setEditingStationId(station.id);
    setEditingName(station.name);
  };

  const commitStationRename = () => {
    if (editingStationId !== null && editingName.trim()) {
      renameStation(editingStationId, editingName.trim());
    }
    setEditingStationId(null);
    setEditingName('');
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
    <div className="h-full overflow-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stations</h2>
        <div className="flex items-center gap-3">
          <Input
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            placeholder="Search items..."
            className="w-52 h-8 text-xs"
          />
          <div className="flex items-center gap-2">
            <Input
              value={newStationName}
              onChange={(e) => setNewStationName(e.target.value)}
              placeholder="New station name..."
              className="w-40 h-8 text-xs"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddStation(); }}
            />
            <button
              type="button"
              onClick={handleAddStation}
              className="btn-add h-8 px-3 text-xs"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Stations are identified by numeric IDs. Rename a station without affecting item assignments.
        Use this view to manage station membership in bulk.
      </p>

      {effectiveStations.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto">
          {effectiveStations.map((station) => {
            const selectedSet = stationSelections[station.id] || new Set<number>();
            const stationItemsSorted = [...filteredItems].sort((a, b) => {
              const aSel = selectedSet.has(a.id) ? 0 : 1;
              const bSel = selectedSet.has(b.id) ? 0 : 1;
              if (aSel !== bSel) return aSel - bSel;
              return a.itemName.localeCompare(b.itemName);
            });
            return (
              <div
                key={station.id}
                className={cn('flex flex-col min-w-[260px] px-2')}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary" />
                    {editingStationId === station.id ? (
                      <input
                        className="input-field h-7 w-32 text-xs"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={commitStationRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitStationRename();
                          if (e.key === 'Escape') {
                            setEditingStationId(null);
                            setEditingName('');
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-sm">{station.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditingStation(station)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Rename station"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStationToDelete(station.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Delete station"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {selectedSet.size} items assigned
                </div>
                <div className="space-y-1 flex-1 overflow-y-auto pr-1 mt-1">
                  {stationItemsSorted.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSet.has(item.id)}
                        onCheckedChange={() => toggleItemForStation(station.id, item.id)}
                      />
                      <span className="truncate">
                        {item.itemName}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          (${item.itemPrice.toFixed(2)})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn-add h-8 px-3 text-xs flex items-center gap-1"
                    onClick={() => handleSaveStationSelection(station.id)}
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No stations found in the data</p>
          <p className="text-sm mt-1">Add a station above or assign station IDs to items</p>
        </div>
      )}

      <AlertDialog open={stationToDelete !== null} onOpenChange={() => setStationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete station?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the station from all items. Printer mapping is configured in Prod Ops and will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (stationToDelete !== null) {
                  deleteStation(stationToDelete);
                }
                setStationToDelete(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
