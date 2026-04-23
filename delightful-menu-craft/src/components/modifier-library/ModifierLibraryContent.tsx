import { useState, useMemo, useEffect, useLayoutEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import {
  Plus,
  GripVertical,
  Trash2,
  Upload,
  Search,
  X,
  Save,
  RotateCcw,
  Package,
  GitBranch,
  ChevronRight,
  ChevronDown,
  List,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatModifierForSelect, formatModifierOptionForSelect } from '@/lib/modifierLabels';
import { parseBulkOptionNames } from '@/lib/bulkOptionNames';
import { fingerprintModifierStructure } from '@/lib/modifierStructureFingerprint';
import {
  VISIBILITY_CHANNELS,
  defaultVisibility,
  getChannelsByGroup,
  type VisibilityChannelKey,
} from '@/lib/visibility';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Modifier, ModifierOption } from '@/types/menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateOptionModal } from './CreateOptionModal';
import { OptionsLibraryModal } from './OptionsLibraryModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

// ---------------------------------------------------------------------------
// Shared confirm dialog
// ---------------------------------------------------------------------------
type ConfirmState = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
} | null;

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <AlertDialog open={state !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          {state?.description && (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { state?.onConfirm(); onClose(); }}
            className={state?.destructive
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : undefined}
          >
            {state?.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ModifierLibraryContent() {
  const {
    modifiers,
    modifierOptions,
    modifierModifierOptions,
    selectedModifierId,
    setSelectedModifier,
    addModifier,
    deleteModifier,
    isDataLoaded,
    getNextId,
  } = useMenuStore();

  const [modifierSearch, setModifierSearch] = useState('');
  const [showOptionsLibrary, setShowOptionsLibrary] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const selectedModifier = modifiers.find(m => m.id === selectedModifierId);
  
  // Filter modifiers by search query
  const filteredModifiers = useMemo(() => {
    if (!modifierSearch.trim()) return modifiers;
    const query = modifierSearch.toLowerCase();
    return modifiers.filter(m =>
      m.modifierName.toLowerCase().includes(query) ||
      m.posDisplayName.toLowerCase().includes(query) ||
      (m.prefix ?? '').toLowerCase().includes(query)
    );
  }, [modifiers, modifierSearch]);

  const handleAddModifier = () => {
    const newModifier: Modifier = {
      id: getNextId('modifiers'),
      modifierName: 'New Modifier',
      posDisplayName: 'New Modifier',
      isNested: false,
      addNested: false,
      modifierOptionPriceType: 'NoCharge',
      isOptional: '',
      canGuestSelectMoreModifiers: true,
      multiSelect: false,
      limitIndividualModifierSelection: false,
      minSelector: 0,
      maxSelector: 1,
      noMaxSelection: false,
      prefix: '',
      pizzaSelection: false,
      price: 0,
      parentModifierId: 0,
      offPrem: true,
      modifierIds: '',
      isSizeModifier: false,
      onPrem: true,
      ...defaultVisibility(),
    };
    addModifier(newModifier);
    setSelectedModifier(newModifier.id);
  };

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Data Loaded</h3>
          <p className="text-sm text-muted-foreground">
            Import an Excel file to manage modifiers
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full">
        {/* Modifier List */}
        <div className="w-[280px] shrink-0 border-r border-panel-border bg-panel-bg flex flex-col">
          <div className="p-4 border-b border-panel-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Modifiers</h2>
              <button className="btn-add" onClick={handleAddModifier}>
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>
            {/* Options Library Button */}
            <button
              onClick={() => setShowOptionsLibrary(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              Options Library
            </button>
          </div>
          
          {/* Search */}
          <div className="px-3 py-2 border-b border-panel-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search modifiers..."
                value={modifierSearch}
                onChange={(e) => setModifierSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {modifierSearch && (
                <button
                  onClick={() => setModifierSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredModifiers.length === 0 && modifierSearch ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No modifiers match "{modifierSearch}"
              </div>
            ) : null}
            {filteredModifiers.map((modifier) => {
              // Count options for this modifier
              const directOptionCount = modifierModifierOptions.filter(
                mmo => mmo.modifierId === modifier.id
              ).length;
              const childModifierCount = modifiers.filter(
                m => m.parentModifierId === modifier.id
              ).length;
              
              return (
                <div
                  key={modifier.id}
                  className={cn(
                    'flex items-start gap-1 px-3 py-2.5 border-b border-panel-border transition-colors',
                    'hover:bg-item-hover',
                    selectedModifierId === modifier.id && 'bg-item-selected border-l-2 border-l-primary',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedModifier(modifier.id)}
                    className="min-w-0 flex-1 text-left cursor-pointer"
                  >
                  <div className="font-medium text-sm">{modifier.modifierName}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {directOptionCount > 0 ? (
                      <span>{directOptionCount} options</span>
                    ) : childModifierCount > 0 ? (
                      <span>{childModifierCount} nested</span>
                    ) : (
                      <span>0 options</span>
                    )}
                    {modifier.addNested && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <GitBranch className="w-3 h-3" />
                        nested
                      </span>
                    )}
                    {modifier.isNested && (
                      <span className="bg-primary/10 text-primary px-1 rounded">child</span>
                    )}
                    {modifier.pizzaSelection && <span className="bg-orange-500/10 text-orange-600 px-1 rounded">Pizza</span>}
                    {modifier.isSizeModifier && <span className="bg-purple-500/10 text-purple-600 px-1 rounded">Size</span>}
                    {VISIBILITY_CHANNELS.filter(ch => (modifier as Record<string, unknown>)[ch.key] !== false).length < VISIBILITY_CHANNELS.length && (
                      <span className="bg-amber-500/10 text-amber-600 px-1 rounded text-[10px]">
                        {VISIBILITY_CHANNELS.filter(ch => (modifier as Record<string, unknown>)[ch.key] !== false).length}/{VISIBILITY_CHANNELS.length} ch
                      </span>
                    )}
                  </div>
                  </button>
                  <button
                    type="button"
                    title="Delete modifier"
                    className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmState({
                        title: 'Delete modifier?',
                        description: `"${modifier.modifierName}" will be permanently removed from the library.`,
                        confirmLabel: 'Delete',
                        destructive: true,
                        onConfirm: () => deleteModifier(modifier.id),
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modifier Detail */}
        <div className="flex-1 bg-background min-h-0 h-full">
          {selectedModifier ? (
            <ModifierDetail modifier={selectedModifier} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a modifier to edit
            </div>
          )}
        </div>
      </div>

      {/* Options Library Modal */}
      <OptionsLibraryModal
        isOpen={showOptionsLibrary}
        onClose={() => setShowOptionsLibrary(false)}
      />

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </>
  );
}

interface ModifierDetailProps {
  modifier: Modifier;
}

/** Same rule as item detail: POS can track modifier name until POS or Prefix is edited separately. */
function modifierNamesInitiallyLinked(m: Modifier): boolean {
  const name = m.modifierName?.trim() ?? '';
  const pos = m.posDisplayName?.trim() ?? '';
  return !pos || pos === name;
}

interface ModifierDraft {
  modifierName: string;
  posDisplayName: string;
  prefix: string;
  onPrem: boolean;
  offPrem: boolean;
  minSelector: number;
  maxSelector: number;
  noMaxSelection: boolean;
  isOptional: string;
  pizzaSelection: boolean;
  isSizeModifier: boolean;
  // Channel visibility
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityQr: boolean;
  visibilityWebsite: boolean;
  visibilityMobileApp: boolean;
  visibilityDoordash: boolean;
}

function ModifierDetail({ modifier }: ModifierDetailProps) {
  const {
    updateModifier,
    deleteModifier,
    deleteModifierOption,
    setSelectedModifier,
    modifiers,
    modifierOptions,
    modifierModifierOptions,
    addModifierOption,
    addModifierModifierOption,
    updateModifierModifierOption,
    removeModifierModifierOption,
    getNextId,
  } = useMenuStore();
  
  const [optionSearch, setOptionSearch] = useState('');
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [bulkCreateText, setBulkCreateText] = useState('');
  const [bulkFromLibraryOpen, setBulkFromLibraryOpen] = useState(false);
  const [bulkLibrarySearch, setBulkLibrarySearch] = useState('');
  const [bulkLibrarySelection, setBulkLibrarySelection] = useState<number[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  /** Which nested child modifier rows are expanded to show their options */
  const [expandedNestedChildIds, setExpandedNestedChildIds] = useState<number[]>([]);
  /** While true, editing the library name also updates POS. Cleared after editing POS or Prefix. */
  const [modifierNameDrivesPos, setModifierNameDrivesPos] = useState(() =>
    modifierNamesInitiallyLinked(modifier),
  );

  // Draft state for modifier fields
  const [draft, setDraft] = useState<ModifierDraft>({
    modifierName: modifier.modifierName,
    posDisplayName: modifier.posDisplayName,
    prefix: modifier.prefix ?? '',
    onPrem: modifier.onPrem,
    offPrem: modifier.offPrem,
    minSelector: modifier.minSelector,
    maxSelector: modifier.maxSelector,
    noMaxSelection: modifier.noMaxSelection,
    isOptional: modifier.isOptional,
    pizzaSelection: modifier.pizzaSelection,
    isSizeModifier: modifier.isSizeModifier,
    ...defaultVisibility(),
    visibilityPos: modifier.visibilityPos ?? true,
    visibilityKiosk: modifier.visibilityKiosk ?? true,
    visibilityQr: modifier.visibilityQr ?? true,
    visibilityWebsite: modifier.visibilityWebsite ?? true,
    visibilityMobileApp: modifier.visibilityMobileApp ?? true,
    visibilityDoordash: modifier.visibilityDoordash ?? true,
  });

  // Reset draft when modifier changes
  useEffect(() => {
    setDraft({
      modifierName: modifier.modifierName,
      posDisplayName: modifier.posDisplayName,
      prefix: modifier.prefix ?? '',
      onPrem: modifier.onPrem,
      offPrem: modifier.offPrem,
      minSelector: modifier.minSelector,
      maxSelector: modifier.maxSelector,
      noMaxSelection: modifier.noMaxSelection,
      isOptional: modifier.isOptional,
      pizzaSelection: modifier.pizzaSelection,
      isSizeModifier: modifier.isSizeModifier,
      ...defaultVisibility(),
      visibilityPos: modifier.visibilityPos ?? true,
      visibilityKiosk: modifier.visibilityKiosk ?? true,
      visibilityQr: modifier.visibilityQr ?? true,
      visibilityWebsite: modifier.visibilityWebsite ?? true,
      visibilityMobileApp: modifier.visibilityMobileApp ?? true,
      visibilityDoordash: modifier.visibilityDoordash ?? true,
    });
    setOptionSearch('');
    setExpandedNestedChildIds([]);
    setBulkCreateText('');
  }, [modifier.id]);

  useEffect(() => {
    if (bulkFromLibraryOpen) {
      setBulkLibrarySelection([]);
      setBulkLibrarySearch('');
    }
  }, [bulkFromLibraryOpen]);

  useEffect(() => {
    setModifierNameDrivesPos(modifierNamesInitiallyLinked(modifier));
  }, [modifier.id, modifier.modifierName, modifier.posDisplayName]);

  const currentStructureFingerprint = useMemo(
    () =>
      fingerprintModifierStructure(
        modifier.id,
        modifierModifierOptions,
        modifier.modifierIds ?? '',
        modifier.addNested,
      ),
    [modifier.id, modifier.modifierIds, modifier.addNested, modifierModifierOptions],
  );

  const [structureBaseline, setStructureBaseline] = useState(() =>
    fingerprintModifierStructure(
      modifier.id,
      modifierModifierOptions,
      modifier.modifierIds ?? '',
      modifier.addNested,
    ),
  );

  // Baseline only when switching which modifier is open — not on every join-table update.
  useLayoutEffect(() => {
    setStructureBaseline(
      fingerprintModifierStructure(
        modifier.id,
        modifierModifierOptions,
        modifier.modifierIds ?? '',
        modifier.addNested,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: capture store snapshot for new `modifier.id` only
  }, [modifier.id]);

  const hasMetadataChanges = useMemo(() => {
    const effectiveDraftPos = draft.posDisplayName.trim() || draft.modifierName.trim();
    const effectiveSavedPos =
      modifier.posDisplayName.trim() || modifier.modifierName.trim();
    return (
      draft.modifierName.trim() !== modifier.modifierName.trim() ||
      effectiveDraftPos !== effectiveSavedPos ||
      draft.prefix.trim() !== (modifier.prefix ?? '').trim() ||
      draft.onPrem !== modifier.onPrem ||
      draft.offPrem !== modifier.offPrem ||
      VISIBILITY_CHANNELS.some(
        (ch) =>
          draft[ch.key as VisibilityChannelKey] !==
          (modifier[ch.key as VisibilityChannelKey] ?? true),
      ) ||
      draft.minSelector !== modifier.minSelector ||
      draft.maxSelector !== modifier.maxSelector ||
      draft.noMaxSelection !== modifier.noMaxSelection ||
      draft.isOptional !== modifier.isOptional ||
      draft.pizzaSelection !== modifier.pizzaSelection ||
      draft.isSizeModifier !== modifier.isSizeModifier
    );
  }, [draft, modifier]);

  const hasStructureChanges = currentStructureFingerprint !== structureBaseline;

  const hasChanges = hasMetadataChanges || hasStructureChanges;

  const handleSave = () => {
    if (hasMetadataChanges) {
      updateModifier(modifier.id, {
        modifierName: draft.modifierName,
        posDisplayName: draft.posDisplayName.trim() || draft.modifierName.trim(),
        prefix: draft.prefix.trim(),
        onPrem: draft.onPrem,
        offPrem: draft.offPrem,
        minSelector: draft.minSelector,
        maxSelector: draft.maxSelector,
        noMaxSelection: draft.noMaxSelection,
        isOptional: draft.isOptional,
        pizzaSelection: draft.pizzaSelection,
        isSizeModifier: draft.isSizeModifier,
        visibilityPos: draft.visibilityPos,
        visibilityKiosk: draft.visibilityKiosk,
        visibilityQr: draft.visibilityQr,
        visibilityWebsite: draft.visibilityWebsite,
        visibilityMobileApp: draft.visibilityMobileApp,
        visibilityDoordash: draft.visibilityDoordash,
      });
    }
    setSelectedModifier(null);
  };

  const handleDiscard = () => {
    setDraft({
      modifierName: modifier.modifierName,
      posDisplayName: modifier.posDisplayName,
      prefix: modifier.prefix ?? '',
      onPrem: modifier.onPrem,
      offPrem: modifier.offPrem,
      minSelector: modifier.minSelector,
      maxSelector: modifier.maxSelector,
      noMaxSelection: modifier.noMaxSelection,
      isOptional: modifier.isOptional,
      pizzaSelection: modifier.pizzaSelection,
      isSizeModifier: modifier.isSizeModifier,
      ...defaultVisibility(),
      visibilityPos: modifier.visibilityPos ?? true,
      visibilityKiosk: modifier.visibilityKiosk ?? true,
      visibilityQr: modifier.visibilityQr ?? true,
      visibilityWebsite: modifier.visibilityWebsite ?? true,
      visibilityMobileApp: modifier.visibilityMobileApp ?? true,
      visibilityDoordash: modifier.visibilityDoordash ?? true,
    });
    setModifierNameDrivesPos(modifierNamesInitiallyLinked(modifier));
    // Clears "dirty" for option/nested edits without reverting store (those are already persisted).
    setStructureBaseline(
      fingerprintModifierStructure(
        modifier.id,
        modifierModifierOptions,
        modifier.modifierIds ?? '',
        modifier.addNested,
      ),
    );
  };

  // Get options for this modifier via join table
  const modifierOptionAssignments = useMemo(() => {
    return modifierModifierOptions
      .filter(mmo => mmo.modifierId === modifier.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(mmo => ({
        ...mmo,
        option: modifierOptions.find(o => o.id === mmo.modifierOptionId),
      }));
  }, [modifierModifierOptions, modifier.id, modifierOptions]);
  
  // Filter options by search
  const filteredOptionAssignments = useMemo(() => {
    if (!optionSearch.trim()) return modifierOptionAssignments;
    const query = optionSearch.toLowerCase();
    return modifierOptionAssignments.filter(a => 
      a.option?.optionName.toLowerCase().includes(query) ||
      a.optionDisplayName.toLowerCase().includes(query)
    );
  }, [modifierOptionAssignments, optionSearch]);

  // Get options not yet assigned to this modifier
  const availableOptions = useMemo(() => {
    const assignedOptionIds = modifierOptionAssignments.map(a => a.modifierOptionId);
    return modifierOptions.filter(o => !assignedOptionIds.includes(o.id));
  }, [modifierOptions, modifierOptionAssignments]);

  const libraryDialogFilteredOptions = useMemo(() => {
    const q = bulkLibrarySearch.trim().toLowerCase();
    if (!q) return availableOptions;
    return availableOptions.filter((o) => {
      const name = o.optionName.toLowerCase();
      const pos = (o.posDisplayName ?? '').toLowerCase();
      const label = formatModifierOptionForSelect(o).toLowerCase();
      return name.includes(q) || pos.includes(q) || label.includes(q);
    });
  }, [availableOptions, bulkLibrarySearch]);

  const handleBulkCreateFromLines = () => {
    const names = parseBulkOptionNames(bulkCreateText);
    if (names.length === 0) return;
    for (const name of names) {
      const {
        modifierModifierOptions: mmo,
        getNextId,
        addModifierOption: addOpt,
        addModifierModifierOption: addJoin,
      } = useMenuStore.getState();
      const count = mmo.filter((m) => m.modifierId === modifier.id).length;
      const newOptionId = getNextId('modifierOptions');
      addOpt({
        id: newOptionId,
        optionName: name,
        posDisplayName: name,
        parentModifierId: modifier.id,
        isStockAvailable: true,
        isSizeModifier: false,
        ...defaultVisibility(),
      });
      addJoin({
        modifierId: modifier.id,
        modifierOptionId: newOptionId,
        isDefaultSelected: false,
        maxLimit: 0,
        optionDisplayName: name,
        sortOrder: count,
        maxQtyPerOption: 1,
      });
    }
    setBulkCreateText('');
  };

  const handleBulkAddExistingFromLibrary = () => {
    if (bulkLibrarySelection.length === 0) return;
    for (const id of bulkLibrarySelection) {
      const option = modifierOptions.find((o) => o.id === id);
      if (!option) continue;
      const count = useMenuStore
        .getState()
        .modifierModifierOptions.filter((m) => m.modifierId === modifier.id).length;
      useMenuStore.getState().addModifierModifierOption({
        modifierId: modifier.id,
        modifierOptionId: id,
        isDefaultSelected: false,
        maxLimit: 0,
        optionDisplayName: option.optionName,
        sortOrder: count,
        maxQtyPerOption: 1,
      });
    }
    setBulkLibrarySelection([]);
    setBulkFromLibraryOpen(false);
  };

  const handleCreateOption = (optionData: {
    optionName: string;
    posDisplayName: string;
    price: number;
    isStockAvailable: boolean;
    isSizeModifier: boolean;
  }) => {
    // Create the new option
    const newOptionId = getNextId('modifierOptions');
    const newOption: ModifierOption = {
      id: newOptionId,
      optionName: optionData.optionName,
      posDisplayName: optionData.posDisplayName,
      parentModifierId: modifier.id,
      isStockAvailable: optionData.isStockAvailable,
      isSizeModifier: optionData.isSizeModifier,
      ...defaultVisibility(),
    };
    addModifierOption(newOption);
    
    // Assign it to this modifier with the price
    addModifierModifierOption({
      modifierId: modifier.id,
      modifierOptionId: newOptionId,
      isDefaultSelected: false,
      maxLimit: optionData.price,
      optionDisplayName: optionData.optionName,
      sortOrder: modifierOptionAssignments.length,
      maxQtyPerOption: 1,
    });
  };

  const handleOptionPriceChange = (optionId: number, maxLimit: number) => {
    updateModifierModifierOption(modifier.id, optionId, { maxLimit });
  };

  const handleOptionQtyChange = (optionId: number, maxQtyPerOption: number) => {
    updateModifierModifierOption(modifier.id, optionId, { maxQtyPerOption });
    // Keep limitIndividualModifierSelection in sync
    const allAssignments = useMenuStore.getState().modifierModifierOptions.filter(
      m => m.modifierId === modifier.id,
    );
    const anyMultiQty = allAssignments.some(
      m => m.modifierOptionId === optionId ? maxQtyPerOption !== 1 : m.maxQtyPerOption !== 1,
    );
    updateModifier(modifier.id, { limitIndividualModifierSelection: anyMultiQty });
  };

  const handleRemoveOption = (optionId: number) => {
    removeModifierModifierOption(modifier.id, optionId);
  };

  const handleDeleteOptionGlobally = (optionId: number, label: string) => {
    const usage = modifierModifierOptions.filter((mmo) => mmo.modifierOptionId === optionId).length;
    const name = label.trim() || 'This option';
    const description = usage > 1
      ? `"${name}" is linked to ${usage} modifiers. It will be removed from the library and all those modifiers.`
      : `"${name}" will be permanently removed from the option library.`;
    setConfirmState({
      title: 'Delete option?',
      description,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => { deleteModifierOption(optionId); },
    });
  };

  const handleDeleteModifier = () => {
    setConfirmState({
      title: 'Delete modifier?',
      description: `"${modifier.modifierName}" will be permanently removed from the library and unlinked from all items.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => { deleteModifier(modifier.id); setSelectedModifier(null); },
    });
  };

  /** Options for any modifier id (join table first, then parentModifierId fallback) */
  const getOptionAssignmentsForModifier = (modId: number) => {
    const joinEntries = modifierModifierOptions
      .filter((mmo) => mmo.modifierId === modId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (joinEntries.length > 0) {
      return joinEntries
        .map((mmo) => ({
          ...mmo,
          option: modifierOptions.find((o) => o.id === mmo.modifierOptionId),
        }))
        .filter((a) => a.option !== undefined);
    }
    const parentLinked = modifierOptions.filter((o) => o.parentModifierId === modId);
    return parentLinked.map((o, idx) => ({
      modifierId: modId,
      modifierOptionId: o.id,
      isDefaultSelected: false,
      maxLimit: 0,
      optionDisplayName: o.optionName,
      sortOrder: idx,
      option: o,
    }));
  };

  const toggleNestedChildExpanded = (childId: number) => {
    setExpandedNestedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId],
    );
  };

  // --- Nested Modifiers ---

  // Parse child modifier IDs from comma-separated string
  const childModifierIds = useMemo(() => {
    if (!modifier.modifierIds) return [];
    return modifier.modifierIds
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id) && id > 0);
  }, [modifier.modifierIds]);

  const childModifiers = useMemo(() => {
    // Primary: use explicit modifierIds if present
    if (childModifierIds.length > 0) {
      return childModifierIds
        .map(id => modifiers.find(m => m.id === id))
        .filter((m): m is Modifier => m !== undefined);
    }
    // Fallback: find modifiers that declare this as their parent
    // (Excel exports parentModifierId on children but not modifierIds on parents)
    return modifiers.filter(m => m.parentModifierId === modifier.id);
  }, [childModifierIds, modifiers, modifier.id]);

  // Derive effective mode from existing data:
  // - has children → nested
  // - has direct options → flat
  // - neither → null (user must choose)
  type ModifierMode = 'flat' | 'nested';
  const detectedMode = useMemo((): ModifierMode | null => {
    if (childModifiers.length > 0) return 'nested';
    if (modifierOptionAssignments.length > 0) return 'flat';
    return null;
  }, [childModifiers.length, modifierOptionAssignments.length]);

  const [chosenMode, setChosenMode] = useState<ModifierMode | null>(detectedMode);

  // Keep chosenMode in sync when modifier changes
  useEffect(() => {
    setChosenMode(detectedMode);
  }, [modifier.id, detectedMode]);

  const effectiveMode = detectedMode ?? chosenMode;

  const handleSwitchMode = (targetMode: 'flat' | 'nested') => {
    if (effectiveMode === targetMode) return;

    if (detectedMode === 'flat') {
      const count = modifierOptionAssignments.length;
      const snapshot = [...modifierOptionAssignments];
      setConfirmState({
        title: 'Switch to Nested Modifiers?',
        description: `This will remove ${count} option assignment${count !== 1 ? 's' : ''} from this modifier.`,
        confirmLabel: 'Switch',
        destructive: false,
        onConfirm: () => {
          snapshot.forEach(a => removeModifierModifierOption(modifier.id, a.modifierOptionId));
          setChosenMode(targetMode);
        },
      });
    } else if (detectedMode === 'nested') {
      const count = childModifiers.length;
      setConfirmState({
        title: 'Switch to Flat Options?',
        description: `This will unlink ${count} nested modifier${count !== 1 ? 's' : ''} from this modifier.`,
        confirmLabel: 'Switch',
        destructive: false,
        onConfirm: () => {
          updateModifier(modifier.id, { modifierIds: '' });
          setChosenMode(targetMode);
        },
      });
    } else {
      setChosenMode(targetMode);
    }
  };

  // Modifiers eligible to be added as children:
  // - not self
  // - not already a child
  // - not already a parent (parentModifierId > 0), unless it's THIS modifier's child
  const availableNestedModifiers = useMemo(() => {
    return modifiers.filter(m =>
      m.id !== modifier.id &&
      !childModifierIds.includes(m.id) &&
      (m.parentModifierId === 0 || m.parentModifierId === modifier.id)
    );
  }, [modifiers, modifier.id, childModifierIds]);

  const handleAddNestedModifier = (childIdStr: string) => {
    const childId = parseInt(childIdStr);
    if (isNaN(childId)) return;

    const updatedIds = [...childModifierIds, childId].join(',');
    updateModifier(modifier.id, {
      modifierIds: updatedIds,
      addNested: true,
    });
    updateModifier(childId, {
      parentModifierId: modifier.id,
      isNested: true,
    });
  };

  const handleRemoveNestedModifier = (childId: number) => {
    const updatedIds = childModifierIds.filter(id => id !== childId);
    updateModifier(modifier.id, {
      modifierIds: updatedIds.join(','),
      addNested: updatedIds.length > 0,
    });
    updateModifier(childId, {
      parentModifierId: 0,
      isNested: false,
    });
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Unsaved changes indicator */}
        {hasChanges && (
          <div className="px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-600 text-xs font-medium">
            You have unsaved changes
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Names — match ItemDetailPanel: section header + inline label rows; name can drive POS until POS/Prefix is edited */}
          <div className="space-y-1">
            <Label className="section-header">Names</Label>
            <div className="space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] leading-tight text-muted-foreground shrink-0 w-[4.25rem]">
                  Name
                </span>
                <input
                  type="text"
                  value={draft.modifierName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) =>
                      modifierNameDrivesPos
                        ? { ...d, modifierName: v, posDisplayName: v }
                        : { ...d, modifierName: v },
                    );
                  }}
                  className="input-field h-8 text-sm font-semibold flex-1 min-w-0 leading-tight py-1"
                  placeholder="Modifier name"
                />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] leading-tight text-muted-foreground shrink-0 w-[4.25rem]">
                  POS
                </span>
                <input
                  type="text"
                  value={draft.posDisplayName}
                  onChange={(e) => {
                    setModifierNameDrivesPos(false);
                    setDraft((d) => ({ ...d, posDisplayName: e.target.value }));
                  }}
                  className="input-field h-7 flex-1 min-w-0 text-xs py-1 leading-tight"
                  placeholder="POS display name"
                />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] leading-tight text-muted-foreground shrink-0 w-[4.25rem]">
                  Prefix
                </span>
                <input
                  id="lib-mod-prefix"
                  type="text"
                  value={draft.prefix}
                  onChange={(e) => {
                    setModifierNameDrivesPos(false);
                    setDraft((d) => ({ ...d, prefix: e.target.value }));
                  }}
                  className="input-field h-7 flex-1 min-w-0 text-xs py-1 leading-tight"
                  placeholder="e.g., TOP, SIDE"
                />
              </div>
            </div>
          </div>

          {/* Nested status badge — shown when this modifier is a child */}
          {modifier.isNested && modifier.parentModifierId > 0 && (() => {
            const parent = modifiers.find(m => m.id === modifier.parentModifierId);
            return parent ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs">
                <span className="text-primary font-medium">Nested under:</span>
                <span className="text-foreground font-semibold">{parent.modifierName}</span>
              </div>
            ) : null;
          })()}

          {/* Modifier Type — always show both buttons; active mode highlighted, inactive greyed & disabled */}
          <div className="space-y-2">
            <Label className="section-header">Modifier Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {/* Flat Options button */}
              {(() => {
                const isActive = effectiveMode === 'flat' || (effectiveMode === null && chosenMode === 'flat');
                const willClear = effectiveMode === 'nested';
                return (
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('flat')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                      isActive
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    <List className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">Flat Options</div>
                      <div className="text-[10px] font-normal opacity-70 leading-tight">
                        {willClear ? 'Switch — will clear nested' : 'Guest picks from a list'}
                      </div>
                    </div>
                  </button>
                );
              })()}
              {/* Nested Modifiers button */}
              {(() => {
                const isActive = effectiveMode === 'nested' || (effectiveMode === null && chosenMode === 'nested');
                const willClear = effectiveMode === 'flat';
                return (
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('nested')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                      isActive
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    <GitBranch className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">Nested Modifiers</div>
                      <div className="text-[10px] font-normal opacity-70 leading-tight">
                        {willClear ? 'Switch — will clear options' : 'Container for sub-modifiers'}
                      </div>
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Nested Modifiers — nested mode only */}
          {(effectiveMode === 'nested' || (effectiveMode === null && chosenMode === 'nested')) &&
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="section-header">
                Nested Modifiers ({childModifiers.length})
              </Label>
              {availableNestedModifiers.length > 0 && (
                <Select onValueChange={handleAddNestedModifier}>
                  <SelectTrigger className="w-40">
                    <span className="text-xs flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      Add Nested
                    </span>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
                    {availableNestedModifiers.map((mod) => (
                      <SelectItem key={mod.id} value={mod.id.toString()}>
                        <span className="line-clamp-2 text-left whitespace-normal">
                          {formatModifierForSelect(mod)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Sub-modifiers that follow this modifier when it's selected by a guest.
            </p>
            <div className="space-y-2">
              {childModifiers.map((child) => {
                const nestedOpts = getOptionAssignmentsForModifier(child.id);
                const optCount = nestedOpts.length;
                const isExpanded = expandedNestedChildIds.includes(child.id);
                return (
                  <div
                    key={child.id}
                    className="rounded-lg border border-border bg-background overflow-hidden group"
                  >
                    <div className="flex items-center gap-2 p-2.5">
                      <button
                        type="button"
                        onClick={() => toggleNestedChildExpanded(child.id)}
                        className="p-0.5 rounded hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground"
                        aria-expanded={isExpanded}
                        title={isExpanded ? 'Collapse options' : 'Expand options'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">
                          {child.posDisplayName || child.modifierName}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{optCount} options</span>
                          {VISIBILITY_CHANNELS.filter(ch => (child as Record<string, unknown>)[ch.key] !== false).length < VISIBILITY_CHANNELS.length && (
                            <span className="bg-amber-500/10 text-amber-600 px-1 rounded">
                              {VISIBILITY_CHANNELS.filter(ch => (child as Record<string, unknown>)[ch.key] !== false).length}/{VISIBILITY_CHANNELS.length} ch
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveNestedModifier(child.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove nested modifier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/25 px-3 py-2 pl-11 space-y-1.5">
                        {nestedOpts.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-1">No options defined</p>
                        ) : (
                          nestedOpts.map((a) => (
                            <div
                              key={a.modifierOptionId}
                              className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/50 last:border-0"
                            >
                              <span className="text-foreground font-medium truncate">
                                {a.option?.posDisplayName || a.option?.optionName || a.optionDisplayName}
                              </span>
                              {a.isDefaultSelected && (
                                <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {childModifiers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No nested modifiers. Use the dropdown above to add one.
                </p>
              )}
            </div>
          </div>}

          {/* Options — flat mode only */}
          {(effectiveMode === 'flat' || (effectiveMode === null && chosenMode === 'flat')) &&
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label className="section-header">Options ({modifierOptionAssignments.length})</Label>
              <div className="flex flex-wrap gap-2">
                {availableOptions.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => setBulkFromLibraryOpen(true)}
                  >
                    Add from library…
                  </Button>
                )}
                <button type="button" className="btn-add" onClick={() => setShowCreateOption(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  New Option
                </button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Bulk create (one name per line, or comma / semicolon separated)</Label>
              <textarea
                value={bulkCreateText}
                onChange={(e) => setBulkCreateText(e.target.value)}
                rows={3}
                placeholder={'e.g.\nSmall\nMedium\nLarge'}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm resize-y min-h-[4.5rem] focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!parseBulkOptionNames(bulkCreateText).length}
                onClick={handleBulkCreateFromLines}
              >
                Add as options
              </Button>
            </div>

            {/* Search Options */}
            {modifierOptionAssignments.length > 3 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search options..."
                  value={optionSearch}
                  onChange={(e) => setOptionSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {optionSearch && (
                  <button
                    onClick={() => setOptionSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {filteredOptionAssignments.length === 0 && optionSearch ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No options match "{optionSearch}"
                </p>
              ) : null}
              {filteredOptionAssignments.map((assignment) => (
                <div
                  key={assignment.modifierOptionId}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div>
                      <span className="text-sm font-medium">
                        {assignment.option?.optionName || assignment.optionDisplayName}
                      </span>
                      {assignment.option?.posDisplayName?.trim() &&
                        assignment.option.posDisplayName.trim() !== assignment.option.optionName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            POS: {assignment.option.posDisplayName}
                          </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {assignment.isDefaultSelected && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                      {assignment.option && !assignment.option.isStockAvailable && (
                        <span className="text-xs bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={assignment.maxLimit}
                        onChange={(e) => handleOptionPriceChange(
                          assignment.modifierOptionId,
                          parseFloat(e.target.value) || 0
                        )}
                        className="input-field w-20"
                      />
                    </div>
                    <div className="flex items-center gap-1" title="Max times a guest can select this option (0 = unlimited)">
                      <span className="text-muted-foreground text-xs">Qty</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={assignment.maxQtyPerOption ?? 1}
                        onChange={(e) => handleOptionQtyChange(
                          assignment.modifierOptionId,
                          Math.max(0, parseInt(e.target.value) || 0)
                        )}
                        className="input-field w-14 text-center"
                      />
                      {(assignment.maxQtyPerOption ?? 1) === 0 && (
                        <span className="text-[10px] text-primary font-semibold">∞</span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted shrink-0"
                        aria-label="Option actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={() => handleRemoveOption(assignment.modifierOptionId)}
                      >
                        Remove from this modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          handleDeleteOptionGlobally(
                            assignment.modifierOptionId,
                            assignment.option?.optionName || assignment.optionDisplayName,
                          )
                        }
                      >
                        Delete from library everywhere…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {modifierOptionAssignments.length === 0 && !optionSearch && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No options added yet. Click "New Option" to create one.
                </p>
              )}
            </div>
          </div>}

          {/* Channel Visibility */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <Label className="section-header">Channel Visibility</Label>
            {Object.entries(getChannelsByGroup()).map(([group, channels]) => (
              <div key={group} className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">{group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {channels.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraft(d => ({ ...d, [key]: !d[key as VisibilityChannelKey] }))}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-md border text-sm font-medium transition-colors",
                        draft[key as VisibilityChannelKey]
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-muted/50 border-border text-muted-foreground line-through"
                      )}
                    >
                      <span>{label}</span>
                      <span className="text-xs">{draft[key as VisibilityChannelKey] ? '✓' : '✕'}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pizza & Size Settings */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <Label className="section-header">Pizza & Size Settings</Label>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="pizzaSelection" className="text-sm">Pizza Selection</Label>
                <p className="text-xs text-muted-foreground">Enable left/right/whole pizza topping selection</p>
              </div>
              <Switch
                id="pizzaSelection"
                checked={draft.pizzaSelection}
                onCheckedChange={(checked) => setDraft(d => ({ ...d, pizzaSelection: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isSizeModifier" className="text-sm">Size Modifier</Label>
                <p className="text-xs text-muted-foreground">This modifier controls item size (e.g., 10", 14", 20")</p>
              </div>
              <Switch
                id="isSizeModifier"
                checked={draft.isSizeModifier}
                onCheckedChange={(checked) => setDraft(d => ({ ...d, isSizeModifier: checked }))}
              />
            </div>
          </div>

          {/* Selection Rules */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="section-header">Min Selection</Label>
              <input
                type="number"
                min={0}
                value={draft.minSelector}
                onChange={(e) => setDraft(d => ({ ...d, minSelector: parseInt(e.target.value) || 0 }))}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="section-header">Max Selection</Label>
              <input
                type="number"
                min={1}
                value={draft.maxSelector}
                onChange={(e) => setDraft(d => ({ ...d, maxSelector: parseInt(e.target.value) || 1 }))}
                disabled={draft.noMaxSelection}
                className="input-field w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="section-header">No maximum</Label>
              <Switch
                checked={draft.noMaxSelection}
                onCheckedChange={(checked) => setDraft(d => ({ ...d, noMaxSelection: checked }))}
              />
            </div>
          </div>

          {/* Optional / Required — empty = unset; same as create flow (not prefilled "Select any") */}
          <div className="space-y-2">
            <Label className="section-header">Selection Type</Label>
            <Select
              value={draft.isOptional === '' ? '__empty__' : draft.isOptional}
              onValueChange={(value) =>
                setDraft((d) => ({ ...d, isOptional: value === '__empty__' ? '' : value }))
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder=" " />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty__" className="text-muted-foreground/70">
                  &nbsp;
                </SelectItem>
                <SelectItem value="Select any">Optional (Select any)</SelectItem>
                <SelectItem value="Required">Required</SelectItem>
                <SelectItem value="Select one">Select One</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>

        {/* Save/Discard buttons */}
        <div className={cn(
          "p-4 border-t border-border bg-panel-bg flex gap-2 transition-opacity",
          hasChanges ? "opacity-100" : "opacity-50 pointer-events-none"
        )}>
          <button
            onClick={handleDiscard}
            disabled={!hasChanges}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>

        <div className="p-3 border-t border-border bg-panel-bg flex-shrink-0">
          <button
            type="button"
            onClick={handleDeleteModifier}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete modifier
          </button>
        </div>
      </div>

      <Dialog open={bulkFromLibraryOpen} onOpenChange={setBulkFromLibraryOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Add options from library</DialogTitle>
            <DialogDescription>
              Select one or more options from the library (not already on this modifier). POS follows each library entry.
            </DialogDescription>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search library options…"
              value={bulkLibrarySearch}
              onChange={(e) => setBulkLibrarySearch(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {bulkLibrarySearch ? (
              <button
                type="button"
                onClick={() => setBulkLibrarySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setBulkLibrarySelection((prev) => [
                  ...new Set([...prev, ...libraryDialogFilteredOptions.map((o) => o.id)]),
                ])
              }
              disabled={libraryDialogFilteredOptions.length === 0}
            >
              Select all{bulkLibrarySearch.trim() ? ' shown' : ''}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setBulkLibrarySelection([])}>
              Clear
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border p-2 space-y-1 max-h-[min(45vh,320px)]">
            {availableOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No unassigned options in the library.</p>
            ) : libraryDialogFilteredOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {`No options match "${bulkLibrarySearch.trim()}"`}
              </p>
            ) : (
              libraryDialogFilteredOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex items-start gap-2 text-sm cursor-pointer rounded-md p-1.5 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={bulkLibrarySelection.includes(option.id)}
                    onCheckedChange={(checked) => {
                      setBulkLibrarySelection((prev) =>
                        checked === true
                          ? prev.includes(option.id)
                            ? prev
                            : [...prev, option.id]
                          : prev.filter((id) => id !== option.id),
                      );
                    }}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 leading-tight">{formatModifierOptionForSelect(option)}</span>
                </label>
              ))
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setBulkFromLibraryOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleBulkAddExistingFromLibrary}
              disabled={bulkLibrarySelection.length === 0}
            >
              Add{bulkLibrarySelection.length ? ` (${bulkLibrarySelection.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Option Modal */}
      <CreateOptionModal
        isOpen={showCreateOption}
        onClose={() => setShowCreateOption(false)}
        onSave={handleCreateOption}
      />

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </>
  );
}
