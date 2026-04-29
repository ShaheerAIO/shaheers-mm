import { useMemo, useState } from 'react';
import { useMenuStore } from '@/store/menuStore';
import type { Station } from '@/types/menu';
import { Upload, Radio, Plus, Pencil, Trash2 } from 'lucide-react';
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
    renumberStation,
    relabelStation,
    deleteStation,
    assignItemToStation,
    unassignItemFromStation,
  } = useMenuStore();

  const [stationToDelete, setStationToDelete] = useState<number | null>(null);
  const [editingStationId, setEditingStationId] = useState<number | null>(null);
  const [editingNumber, setEditingNumber] = useState('');
  const [numberError, setNumberError] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
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
      .map((id) => ({ id }));
  }, [items]);

  const effectiveStations: Station[] = stations.length > 0 ? stations : derivedStationsFromItems;

  // Derive which item IDs belong to each station directly from store
  const stationItemIds = useMemo(() => {
    const map: Record<number, Set<number>> = {};
    effectiveStations.forEach((s) => { map[s.id] = new Set<number>(); });
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
  }, [items, effectiveStations]);

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

  const startEditingNumber = (station: Station) => {
    setEditingStationId(station.id);
    setEditingNumber(String(station.id));
    setNumberError(false);
  };

  const commitNumberEdit = (oldId: number) => {
    const newId = parseInt(editingNumber, 10);
    if (!isNaN(newId) && newId !== oldId) {
      const ok = renumberStation(oldId, newId);
      if (!ok) {
        setNumberError(true);
        return;
      }
    }
    setEditingStationId(null);
    setEditingNumber('');
    setNumberError(false);
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
        <Input
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder="Search items..."
          className="w-52 h-8 text-xs"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Stations are identified by numeric IDs. Station names are configured separately in Prod Ops.
        Changes to item assignments are saved automatically.
      </p>

      <button
        type="button"
        onClick={() => addStation()}
        className="btn-add self-start flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg"
      >
        <Plus className="w-4 h-4" />
        Add Station
      </button>

      {effectiveStations.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {effectiveStations.map((station) => {
            const assignedSet = stationItemIds[station.id] ?? new Set<number>();
            const stationItemsSorted = [...filteredItems].sort((a, b) => {
              const aSel = assignedSet.has(a.id) ? 0 : 1;
              const bSel = assignedSet.has(b.id) ? 0 : 1;
              if (aSel !== bSel) return aSel - bSel;
              return a.itemName.localeCompare(b.itemName);
            });
            const isEditing = editingStationId === station.id;
            return (
              <div
                key={station.id}
                className={cn('flex flex-col min-w-[260px] px-2')}
              >
                {/* Station header */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary shrink-0" />
                    {isEditing ? (
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="number"
                          min={1}
                          className={cn(
                            'input-field h-7 w-20 text-sm font-semibold',
                            numberError && 'border-destructive',
                          )}
                          value={editingNumber}
                          onChange={(e) => {
                            setEditingNumber(e.target.value);
                            setNumberError(false);
                          }}
                          onBlur={() => commitNumberEdit(station.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitNumberEdit(station.id);
                            if (e.key === 'Escape') {
                              setEditingStationId(null);
                              setEditingNumber('');
                              setNumberError(false);
                            }
                          }}
                          autoFocus
                        />
                        {numberError && (
                          <span className="text-[10px] text-destructive">ID already in use</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-bold text-lg leading-none">
                        Station {station.id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEditingNumber(station)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Change station number"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
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

                {/* Editable display label */}
                {editingLabelId === station.id ? (
                  <input
                    className="input-field h-6 w-full text-xs mb-2"
                    placeholder="Label (e.g. Grill, Expo)..."
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={() => {
                      relabelStation(station.id, editingLabel);
                      setEditingLabelId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        relabelStation(station.id, editingLabel);
                        setEditingLabelId(null);
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLabelId(station.id);
                      setEditingLabel(station.label ?? '');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground text-left mb-2 truncate w-full"
                    title="Click to add a display label"
                  >
                    {station.label ?? <span className="italic opacity-50">Add a label...</span>}
                  </button>
                )}

                <div className="text-xs text-muted-foreground mb-3">
                  {assignedSet.size} item{assignedSet.size !== 1 ? 's' : ''} assigned
                </div>

                <div className="space-y-1 flex-1 overflow-y-auto pr-1">
                  {stationItemsSorted.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <Checkbox
                        checked={assignedSet.has(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            assignItemToStation(item.id, station.id);
                          } else {
                            unassignItemFromStation(item.id, station.id);
                          }
                        }}
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
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No stations yet</p>
          <p className="text-sm mt-1">Click "Add Station" above to create your first station</p>
        </div>
      )}

      <AlertDialog open={stationToDelete !== null} onOpenChange={() => setStationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete station?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove Station {stationToDelete} from all items. Printer mapping in Prod Ops will not be affected.
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
