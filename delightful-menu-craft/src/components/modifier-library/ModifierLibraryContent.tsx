import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
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
  ArrowUpDown,
  Layers,
  Pencil,
  Copy,
  Table as TableIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatModifierForSelect, formatModifierOptionForSelect } from '@/lib/modifierLabels';
import { parseBulkOptionNames } from '@/lib/bulkOptionNames';
import { fingerprintModifierStructure } from '@/lib/modifierStructureFingerprint';
import { modifierSelectionCeiling } from '@/lib/posPricing';
import { useClearableIntInput } from '@/hooks/useClearableIntInput';
import { NumberStepperInput } from '@/components/ui/number-stepper-input';
import { PriceStepperInput } from '@/components/ui/price-stepper-input';
import {
  VISIBILITY_CHANNELS,
  defaultVisibility,
  getChannelsByGroup,
  toggleVisibilityChannel,
  type VisibilityChannelKey,
} from '@/lib/visibility';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Modifier, ModifierGroup, ModifierOption } from '@/types/menu';
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
    modifierGroups,
    itemModifiers,
    selectedModifierId,
    setSelectedModifier,
    addModifier,
    deleteModifier,
    duplicateModifier,
    addModifierGroup,
    updateModifierGroup,
    deleteModifierGroup,
    isDataLoaded,
    getNextId,
  } = useMenuStore();

  const [libView, setLibView] = useState<'modifiers' | 'groups' | 'overview'>('modifiers');
  const [overviewFilter, setOverviewFilter] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [modifierSearch, setModifierSearch] = useState('');
  const { modifierSort, setModifierSort } = useUserPreferencesStore();
  const [showOptionsLibrary, setShowOptionsLibrary] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const selectedModifier = modifiers.find(m => m.id === selectedModifierId);
  const selectedGroup = modifierGroups.find(g => g.id === selectedGroupId);
  
  // Filter and sort modifiers
  const filteredModifiers = useMemo(() => {
    let result = modifiers.filter(m => {
      if (!modifierSearch.trim()) return true;
      const query = modifierSearch.toLowerCase();
      return (
        m.modifierName.toLowerCase().includes(query) ||
        m.posDisplayName.toLowerCase().includes(query) ||
        (m.prefix ?? '').toLowerCase().includes(query)
      );
    });

    if (modifierSort === 'new-old') {
      result = [...result].reverse();
    } else if (modifierSort === 'name-asc') {
      result = [...result].sort((a, b) => a.modifierName.localeCompare(b.modifierName));
    } else if (modifierSort === 'name-desc') {
      result = [...result].sort((a, b) => b.modifierName.localeCompare(a.modifierName));
    } else if (modifierSort === 'options-desc' || modifierSort === 'options-asc') {
      const count = (m: Modifier) => modifierModifierOptions.filter(mmo => mmo.modifierId === m.id).length;
      result = [...result].sort((a, b) =>
        modifierSort === 'options-desc' ? count(b) - count(a) : count(a) - count(b)
      );
    }

    return result;
  }, [modifiers, modifierSearch, modifierSort, modifierModifierOptions]);

  const handleAddGroup = () => {
    const name = newGroupName.trim();
    if (getGroupNameError(newGroupName)) return;
    const newGroup: ModifierGroup = {
      id: getNextId('modifierGroups'),
      groupName: name,
      posDisplayName: name,
      onPrem: true,
      offPrem: true,
      modifierIds: '',
      modifierName: '',
    };
    addModifierGroup(newGroup);
    setSelectedGroupId(newGroup.id);
    setNewGroupName('');
  };

  const filteredGroups = modifierGroups.filter((g) => {
    if (!groupSearch.trim()) return true;
    return g.groupName.toLowerCase().includes(groupSearch.toLowerCase());
  });

  const handleAddModifier = () => {
    const newModifier: Modifier = {
      id: getNextId('modifiers'),
      modifierName: 'New Modifier',
      posDisplayName: 'New Modifier',
      isNested: false,
      addNested: false,
      modifierOptionPriceType: 'Individual',
      isOptional: 'Select any',
      canGuestSelectMoreModifiers: false,
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
        {/* Modifier / Groups List */}
        <div className="w-[280px] shrink-0 border-r border-panel-border bg-panel-bg flex flex-col">
          {/* View toggle */}
          <div className="flex border-b border-panel-border">
            <button
              type="button"
              onClick={() => setLibView('modifiers')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                libView === 'modifiers'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="w-3.5 h-3.5" />
              Modifiers
            </button>
            <button
              type="button"
              onClick={() => setLibView('groups')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                libView === 'groups'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Groups
            </button>
            <button
              type="button"
              onClick={() => setLibView('overview')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                libView === 'overview'
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Overview
            </button>
          </div>

          {libView === 'overview' ? (
            <div className="p-4 text-xs text-muted-foreground space-y-2">
              <p>Read-only overview of every modifier → option assignment with its price, quantity, and default flag.</p>
              <p>Use the filter above the table to narrow results.</p>
            </div>
          ) : libView === 'modifiers' ? (
            <>
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

          {/* Sort */}
          <div className="px-3 py-1.5 border-b border-panel-border flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Select value={modifierSort} onValueChange={(v) => setModifierSort(v as typeof modifierSort)}>
              <SelectTrigger className="h-7 text-xs flex-1 border-0 bg-transparent shadow-none focus:ring-0 px-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default order</SelectItem>
                <SelectItem value="new-old">New → Old</SelectItem>
                <SelectItem value="name-asc">Name A → Z</SelectItem>
                <SelectItem value="name-desc">Name Z → A</SelectItem>
                <SelectItem value="options-desc">Most options first</SelectItem>
                <SelectItem value="options-asc">Fewest options first</SelectItem>
              </SelectContent>
            </Select>
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
              const usedByCount = itemModifiers.filter(
                im => im.modifierId === modifier.id
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
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {modifier.modifierName}
                    <span className="text-xs text-muted-foreground/60 font-normal">#{modifier.id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {directOptionCount > 0 ? (
                      <span>{directOptionCount} options</span>
                    ) : childModifierCount > 0 ? (
                      <span>{childModifierCount} nested</span>
                    ) : (
                      <span>0 options</span>
                    )}
                    <span className="bg-muted text-muted-foreground px-1 rounded">
                      Min: {modifier.minSelector} / Max: {modifier.noMaxSelection ? '∞' : modifier.maxSelector}
                    </span>
                    {usedByCount > 0 && (
                      <span className="bg-blue-500/10 text-blue-600 px-1 rounded">
                        used by {usedByCount}
                      </span>
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
                    title="Duplicate modifier"
                    className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateModifier(modifier.id);
                    }}
                  >
                    <Copy className="w-4 h-4" />
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
            </>
          ) : (
            /* ---- Groups List ---- */
            <>
              {/* Create new group */}
              <div className="p-3 border-b border-panel-border">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup(); }}
                    placeholder="New group name…"
                    className="flex-1 input-field h-7 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    disabled={!!getGroupNameError(newGroupName)}
                    className="btn-add disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                {newGroupName.length > 0 && getGroupNameError(newGroupName) && (
                  <p className="text-[10px] text-destructive mt-1">{getGroupNameError(newGroupName)}</p>
                )}
              </div>
              {/* Group search */}
              <div className="px-3 py-2 border-b border-panel-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search groups…"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {groupSearch && (
                    <button
                      onClick={() => setGroupSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {/* Groups list */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {filteredGroups.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {modifierGroups.length === 0 ? 'No groups yet. Create one above.' : 'No matches.'}
                  </div>
                )}
                {filteredGroups.map((group) => {
                  const modCount = group.modifierIds
                    ? group.modifierIds.split(',').filter((s) => s.trim()).length
                    : 0;
                  return (
                    <div
                      key={group.id}
                      className={cn(
                        'flex items-start gap-1 px-3 py-2.5 border-b border-panel-border transition-colors hover:bg-item-hover cursor-pointer',
                        selectedGroupId === group.id && 'bg-item-selected border-l-2 border-l-primary',
                      )}
                      onClick={() => setSelectedGroupId(group.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{group.groupName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{modCount} modifier{modCount !== 1 ? 's' : ''}</div>
                      </div>
                      <button
                        type="button"
                        title="Delete group"
                        className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmState({
                            title: 'Delete group?',
                            description: `"${group.groupName}" will be permanently removed.`,
                            confirmLabel: 'Delete',
                            destructive: true,
                            onConfirm: () => {
                              deleteModifierGroup(group.id);
                              if (selectedGroupId === group.id) setSelectedGroupId(null);
                            },
                          });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 bg-background min-h-0 h-full">
          {libView === 'overview' ? (
            <ModifierOptionOverview
              modifiers={modifiers}
              modifierOptions={modifierOptions}
              modifierModifierOptions={modifierModifierOptions}
              filter={overviewFilter}
              setFilter={setOverviewFilter}
            />
          ) : libView === 'modifiers' ? (
            selectedModifier ? (
              <ModifierDetail modifier={selectedModifier} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a modifier to edit
              </div>
            )
          ) : selectedGroup ? (
            <ModifierGroupDetail
              group={selectedGroup}
              modifiers={modifiers}
              updateModifierGroup={updateModifierGroup}
              onDelete={() =>
                setConfirmState({
                  title: 'Delete group?',
                  description: `"${selectedGroup.groupName}" will be permanently removed.`,
                  confirmLabel: 'Delete',
                  destructive: true,
                  onConfirm: () => {
                    deleteModifierGroup(selectedGroup.id);
                    setSelectedGroupId(null);
                  },
                })
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a group to edit
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

function getGroupNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'Group name cannot contain spaces only';
  if (trimmed.length === 0) return 'Group name required';
  if (trimmed.length > 24) return 'Group name must be 1–24 characters';
  return null;
}

function getGroupPosNameError(value: string): string | null {
  if (value.length === 0) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'POS name cannot contain spaces only';
  if (trimmed.length > 60) return 'POS name must be 1–60 characters';
  return null;
}

function getModifierNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'Modifier name cannot contain spaces only';
  if (trimmed.length === 0) return 'Modifier name required';
  if (/^\d$/.test(trimmed)) return null;
  if (trimmed.length < 1 || trimmed.length > 40) return 'Modifier name must be between 1-40 characters';
  return null;
}

function getModifierPosNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'POS name cannot contain spaces only';
  if (trimmed.length === 0) return 'POS name required';
  if (trimmed.length < 1 || trimmed.length > 60) return 'POS name must be between 1-60 characters';
  return null;
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
  modifierOptionPriceType: string;
  multiSelect: boolean;
  canGuestSelectMoreModifiers: boolean;
  pizzaSelection: boolean;
  isSizeModifier: boolean;
  // Channel visibility
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityMenuBoard: boolean;
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
    items,
    itemModifiers,
    addModifierOption,
    addModifierModifierOption,
    updateModifierOption,
    updateModifierModifierOption,
    removeModifierModifierOption,
    reorderModifierOptions,
    setModifierOptionOrder,
    getNextId,
  } = useMenuStore();
  
  const [optionSearch, setOptionSearch] = useState('');
  const [optionSortMenuOpen, setOptionSortMenuOpen] = useState(false);
  const optionSortMenuRef = useRef<HTMLDivElement>(null);
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [bulkCreateText, setBulkCreateText] = useState('');
  const [bulkFromLibraryOpen, setBulkFromLibraryOpen] = useState(false);
  const [bulkLibrarySearch, setBulkLibrarySearch] = useState('');
  const [bulkLibrarySelection, setBulkLibrarySelection] = useState<number[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  /** Which nested child modifier rows are expanded to show their options */
  const [expandedNestedChildIds, setExpandedNestedChildIds] = useState<number[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  /** While true, editing the library name also updates POS. Cleared after editing POS or Prefix. */
  const [modifierNameDrivesPos, setModifierNameDrivesPos] = useState(() =>
    modifierNamesInitiallyLinked(modifier),
  );
  const [touched, setTouched] = useState({ modifierName: false, posDisplayName: false });

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
    modifierOptionPriceType: modifier.modifierOptionPriceType ?? 'NoCharge',
    multiSelect: modifier.multiSelect ?? false,
    canGuestSelectMoreModifiers: modifier.canGuestSelectMoreModifiers ?? true,
    pizzaSelection: modifier.pizzaSelection,
    isSizeModifier: modifier.isSizeModifier,
    ...defaultVisibility(),
    visibilityPos: modifier.visibilityPos ?? true,
    visibilityKiosk: modifier.visibilityKiosk ?? true,
    visibilityMenuBoard: modifier.visibilityMenuBoard ?? true,
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
      modifierOptionPriceType: modifier.modifierOptionPriceType ?? 'NoCharge',
      multiSelect: modifier.multiSelect ?? false,
      canGuestSelectMoreModifiers: modifier.canGuestSelectMoreModifiers ?? true,
      pizzaSelection: modifier.pizzaSelection,
      isSizeModifier: modifier.isSizeModifier,
      ...defaultVisibility(),
      visibilityPos: modifier.visibilityPos ?? true,
      visibilityKiosk: modifier.visibilityKiosk ?? true,
      visibilityMenuBoard: modifier.visibilityMenuBoard ?? true,
      visibilityQr: modifier.visibilityQr ?? true,
      visibilityWebsite: modifier.visibilityWebsite ?? true,
      visibilityMobileApp: modifier.visibilityMobileApp ?? true,
      visibilityDoordash: modifier.visibilityDoordash ?? true,
    });
    setOptionSearch('');
    setExpandedNestedChildIds([]);
    setBulkCreateText('');
    setDragIndex(null);
    setDragOverIndex(null);
    setTouched({ modifierName: false, posDisplayName: false });
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

  // Sync minSelector with selection type: Required/Select one force a minimum
  // of 1; every other type (including reverting back to optional/unset)
  // resets to 0.
  useEffect(() => {
    if (draft.isOptional === 'Required' || draft.isOptional === 'Select one') {
      if (draft.minSelector === 0) setDraft(d => ({ ...d, minSelector: 1 }));
    } else if (draft.minSelector !== 0) {
      setDraft(d => ({ ...d, minSelector: 0 }));
    }
  }, [draft.isOptional]);

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
  const [openChannelGroup, setOpenChannelGroup] = useState<string | null>(null);

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
      draft.modifierOptionPriceType !== (modifier.modifierOptionPriceType ?? 'NoCharge') ||
      draft.multiSelect !== (modifier.multiSelect ?? false) ||
      draft.canGuestSelectMoreModifiers !== (modifier.canGuestSelectMoreModifiers ?? true) ||
      draft.pizzaSelection !== modifier.pizzaSelection ||
      draft.isSizeModifier !== modifier.isSizeModifier
    );
  }, [draft, modifier]);

  const hasStructureChanges = currentStructureFingerprint !== structureBaseline;

  const hasChanges = hasMetadataChanges || hasStructureChanges;
  const maxSelectorValid = draft.noMaxSelection || draft.maxSelector >= draft.minSelector;
  const modifierNameError = getModifierNameError(draft.modifierName);
  const posNameError = getModifierPosNameError(draft.posDisplayName);
  const isNamesValid = !modifierNameError && !posNameError;

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
        modifierOptionPriceType: draft.modifierOptionPriceType,
        multiSelect: draft.multiSelect,
        canGuestSelectMoreModifiers: draft.canGuestSelectMoreModifiers,
        pizzaSelection: draft.pizzaSelection,
        isSizeModifier: draft.isSizeModifier,
        visibilityPos: draft.visibilityPos,
        visibilityKiosk: draft.visibilityKiosk,
        visibilityMenuBoard: draft.visibilityMenuBoard,
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
      modifierOptionPriceType: modifier.modifierOptionPriceType ?? 'NoCharge',
      multiSelect: modifier.multiSelect ?? false,
      canGuestSelectMoreModifiers: modifier.canGuestSelectMoreModifiers ?? true,
      pizzaSelection: modifier.pizzaSelection,
      isSizeModifier: modifier.isSizeModifier,
      ...defaultVisibility(),
      visibilityPos: modifier.visibilityPos ?? true,
      visibilityKiosk: modifier.visibilityKiosk ?? true,
      visibilityMenuBoard: modifier.visibilityMenuBoard ?? true,
      visibilityQr: modifier.visibilityQr ?? true,
      visibilityWebsite: modifier.visibilityWebsite ?? true,
      visibilityMobileApp: modifier.visibilityMobileApp ?? true,
      visibilityDoordash: modifier.visibilityDoordash ?? true,
    });
    setModifierNameDrivesPos(modifierNamesInitiallyLinked(modifier));
    setTouched({ modifierName: false, posDisplayName: false });
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
  
  // Dynamic Max SELECTION ceiling from the three toggles (see modifierSelectionCeiling)
  const selectionCeiling = useMemo(
    () =>
      modifierSelectionCeiling({
        multiSelect: draft.multiSelect,
        allowRepeat: draft.canGuestSelectMoreModifiers,
        limitPerOption: modifierOptionAssignments.some(a => (a.maxQtyPerOption ?? 1) !== 1),
        optionCount: modifierOptionAssignments.length,
        perOptionLimits: modifierOptionAssignments.map(a => a.maxQtyPerOption ?? 1),
      }),
    [draft.multiSelect, draft.canGuestSelectMoreModifiers, modifierOptionAssignments],
  );

  // No-charge modifiers can't carry per-option prices — zero any that were
  // entered before switching pricing type.
  const isNoCharge = draft.modifierOptionPriceType === 'NoCharge';
  useEffect(() => {
    if (!isNoCharge) return;
    modifierOptionAssignments.forEach((a) => {
      if (a.maxLimit !== 0) updateModifierModifierOption(modifier.id, a.modifierOptionId, { maxLimit: 0 });
    });
  }, [isNoCharge, modifierOptionAssignments, modifier.id, updateModifierModifierOption]);

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

  // Size modifiers: add a blank size inline (no modal) — the user edits name + cost in the row.
  const handleAddSize = () => {
    const newOptionId = getNextId('modifierOptions');
    const count = modifierModifierOptions.filter((m) => m.modifierId === modifier.id).length;
    addModifierOption({
      id: newOptionId,
      optionName: '',
      posDisplayName: '',
      parentModifierId: modifier.id,
      isStockAvailable: true,
      isSizeModifier: true,
      ...defaultVisibility(),
    });
    addModifierModifierOption({
      modifierId: modifier.id,
      modifierOptionId: newOptionId,
      isDefaultSelected: false,
      maxLimit: 0,
      optionDisplayName: '',
      sortOrder: count,
      maxQtyPerOption: 1,
    });
  };

  // Editing a size's name keeps the option name, its POS name, and the assignment label in sync.
  const handleSizeNameChange = (optionId: number, name: string) => {
    updateModifierOption(optionId, { optionName: name, posDisplayName: name });
    updateModifierModifierOption(modifier.id, optionId, { optionDisplayName: name });
  };

  const handleOptionPriceChange = (optionId: number, maxLimit: number) => {
    updateModifierModifierOption(modifier.id, optionId, { maxLimit });
  };

  const handleOptionDisplayNameChange = (optionId: number, optionDisplayName: string) => {
    updateModifierModifierOption(modifier.id, optionId, { optionDisplayName });
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

  const isDragDisabled = optionSearch.trim().length > 0;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (isDragDisabled) { e.preventDefault(); return; }
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (isDragDisabled || dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragOverIndex) setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (isDragDisabled || dragIndex === null) return;
    const from = dragIndex;
    const to = index;
    setDragIndex(null);
    setDragOverIndex(null);
    if (from !== to) reorderModifierOptions(modifier.id, from, to);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    if (!optionSortMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (optionSortMenuRef.current && !optionSortMenuRef.current.contains(e.target as Node)) {
        setOptionSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [optionSortMenuOpen]);

  /** (Re)sort this modifier's options by name or price and persist the new sortOrder. */
  const handleSortOptions = (key: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc') => {
    const sorted = [...modifierOptionAssignments].sort((a, b) => {
      if (key === 'price-asc' || key === 'price-desc') {
        return a.maxLimit - b.maxLimit;
      }
      return (a.option?.optionName || a.optionDisplayName).localeCompare(
        b.option?.optionName || b.optionDisplayName,
        undefined,
        { sensitivity: 'base' },
      );
    });
    if (key === 'name-desc' || key === 'price-desc') sorted.reverse();
    setModifierOptionOrder(modifier.id, sorted.map((o) => o.modifierOptionId));
    setOptionSortMenuOpen(false);
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

  // Items that use this modifier (read-only) — via the itemModifiers join.
  const usedByItems = useMemo(() => {
    const itemIds = itemModifiers
      .filter(im => im.modifierId === modifier.id)
      .map(im => im.itemId);
    return items
      .filter(it => itemIds.includes(it.id))
      .map(it => it.itemName || it.posDisplayName || `#${it.id}`);
  }, [itemModifiers, items, modifier.id]);

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

  // Total number of choices a guest could pick from (flat options or nested
  // sub-modifiers). The Max SELECTION field must never exceed this, regardless
  // of the (separately displayed) combination limit.
  const availableOptionCount =
    effectiveMode === 'nested' ? childModifiers.length : modifierOptionAssignments.length;
  const maxSelectorCeiling =
    Math.min(isFinite(selectionCeiling) ? selectionCeiling : Infinity, availableOptionCount || Infinity);

  // Keep Max SELECTION from silently exceeding the option/sub-modifier count
  // as options or nested modifiers are added or removed.
  useEffect(() => {
    if (draft.noMaxSelection || availableOptionCount === 0) return;
    setDraft((d) => (d.maxSelector > availableOptionCount ? { ...d, maxSelector: availableOptionCount } : d));
  }, [availableOptionCount, draft.noMaxSelection]);

  const minSelectorField = useClearableIntInput(draft.minSelector, (parsed) => {
    setDraft((d) => {
      const isRequired = d.isOptional === 'Required' || d.isOptional === 'Select one';
      const floor = isRequired ? 1 : 0;
      return { ...d, minSelector: Math.max(floor, Math.min(parsed, d.noMaxSelection ? Infinity : d.maxSelector)) };
    });
  });
  const maxSelectorField = useClearableIntInput(draft.maxSelector, (parsed) => {
    setDraft((d) => ({ ...d, maxSelector: Math.min(maxSelectorCeiling, Math.max(parsed, d.minSelector)) }));
  });

  // A size modifier is inherently a flat list of sizes. Reveal the Sizes editor
  // even for a persisted size modifier opened with no options yet — toggling
  // alone only fires on user interaction, not when the panel mounts.
  useEffect(() => {
    if (draft.isSizeModifier && childModifiers.length === 0 && effectiveMode !== 'flat') {
      setChosenMode('flat');
    }
  }, [draft.isSizeModifier, childModifiers.length, effectiveMode]);

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
  // - not itself a parent of nested modifiers — nesting is one level only, so a
  //   modifier that already contains nested modifiers can't also be nested.
  const availableNestedModifiers = useMemo(() => {
    return modifiers.filter(m =>
      m.id !== modifier.id &&
      !childModifierIds.includes(m.id) &&
      (m.parentModifierId === 0 || m.parentModifierId === modifier.id) &&
      !m.addNested
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
          {/* Names (left) + Modifier Type (right) — same row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Names — compact rows, label to the left of each field */}
            <div className="space-y-1.5 p-4 bg-muted/30 rounded-lg">
              <Label className="section-header">Names</Label>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-[4.5rem]">Name</span>
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
                    onBlur={() => {
                      const trimmed = draft.modifierName.trim();
                      setDraft((d) =>
                        modifierNameDrivesPos
                          ? { ...d, modifierName: trimmed, posDisplayName: trimmed }
                          : { ...d, modifierName: trimmed },
                      );
                      setTouched((t) => ({ ...t, modifierName: true }));
                    }}
                    className="input-field h-8 text-sm font-semibold flex-1 min-w-0 leading-tight py-1"
                    placeholder="Modifier name"
                  />
                </div>
                {touched.modifierName && modifierNameError && (
                  <p className="text-[10px] text-destructive ml-[5rem]">{modifierNameError}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-[4.5rem]">POS name</span>
                  <input
                    type="text"
                    value={draft.posDisplayName}
                    onChange={(e) => {
                      setModifierNameDrivesPos(false);
                      setDraft((d) => ({ ...d, posDisplayName: e.target.value }));
                    }}
                    onBlur={() => {
                      setDraft((d) => ({ ...d, posDisplayName: d.posDisplayName.trim() }));
                      setTouched((t) => ({ ...t, posDisplayName: true }));
                    }}
                    className="input-field h-7 flex-1 min-w-0 text-xs py-1 leading-tight"
                    placeholder="POS display name"
                  />
                </div>
                {touched.posDisplayName && posNameError && (
                  <p className="text-[10px] text-destructive ml-[5rem]">{posNameError}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-[4.5rem]">Prefix</span>
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
              {/* Selection limits summary */}
              <div className="text-xs text-muted-foreground pt-0.5 flex items-center gap-2 flex-wrap">
                {draft.isOptional?.trim() ? `${draft.isOptional} • ` : ''}
                <span className="font-medium text-foreground">
                  Min: {draft.minSelector} / Max: {draft.noMaxSelection ? '∞' : draft.maxSelector}
                </span>
              </div>
            </div>

            {/* Modifier Type — buttons + used-by/nested info underneath, to fill the column */}
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
              <Label className="section-header">Modifier Type</Label>
              <div className="flex flex-col gap-2">
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
                  // One level of nesting only: a modifier already nested under a
                  // parent can't also become a container for its own nested modifiers.
                  const isChild = modifier.isNested && modifier.parentModifierId > 0;
                  return (
                    <button
                      type="button"
                      disabled={isChild}
                      onClick={() => { if (!isChild) handleSwitchMode('nested'); }}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                        isChild
                          ? 'border-border text-muted-foreground opacity-50 cursor-not-allowed'
                          : isActive
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      <GitBranch className="w-4 h-4 shrink-0" />
                      <div>
                        <div className="font-semibold text-xs">Nested Modifiers</div>
                        <div className="text-[10px] font-normal opacity-70 leading-tight">
                          {isChild
                            ? "Can't nest — already nested under a parent"
                            : willClear ? 'Switch — will clear options' : 'Container for sub-modifiers'}
                        </div>
                      </div>
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Used by items — same column as Names, boxed label */}
            <div className="flex items-start gap-2 px-3 py-2 bg-muted/40 border border-border rounded-lg text-xs">
              <span className="text-muted-foreground font-medium shrink-0 pt-0.5">Used by:</span>
              {usedByItems.length === 0 ? (
                <span className="text-muted-foreground">Not attached to any items.</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {usedByItems.map((name, i) => (
                    <span
                      key={i}
                      className="text-foreground font-medium bg-background border border-border px-1.5 py-0.5 rounded"
                    >
                      {name}
                    </span>
                  ))}
                </span>
              )}
            </div>

            {/* Nested under — same column as Modifier Type, boxed label */}
            {modifier.isNested && modifier.parentModifierId > 0 && (() => {
              const parent = modifiers.find(m => m.id === modifier.parentModifierId);
              return parent ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs">
                  <span className="text-primary font-medium">Nested under:</span>
                  <span className="text-foreground font-semibold">{parent.modifierName}</span>
                </div>
              ) : null;
            })()}
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
              <Label className="section-header">{draft.isSizeModifier ? 'Sizes' : 'Options'} ({modifierOptionAssignments.length})</Label>
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
                <button type="button" className="btn-add" onClick={() => draft.isSizeModifier ? handleAddSize() : setShowCreateOption(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  {draft.isSizeModifier ? 'New Size' : 'New Option'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
              {/* Options list — single column so drag-to-reorder stays readable */}
              <div className="space-y-2 min-w-0">
                {/* Search + sort options */}
                {(modifierOptionAssignments.length > 3 || modifierOptionAssignments.length > 1) && (
                  <div className="flex items-center gap-2">
                    {modifierOptionAssignments.length > 3 && (
                      <div className="relative flex-1">
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
                    {modifierOptionAssignments.length > 1 && (
                      <div className="relative shrink-0 ml-auto" ref={optionSortMenuRef}>
                        <button
                          type="button"
                          onClick={() => setOptionSortMenuOpen((o) => !o)}
                          className="flex items-center justify-center w-9 h-9 rounded-md border border-input hover:bg-muted/50 transition-colors"
                          title="Sort options"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        {optionSortMenuOpen && (
                          <div className="absolute z-20 right-0 top-full mt-1 w-40 rounded-md border border-border bg-background shadow-md py-1">
                            <button
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                              onClick={() => handleSortOptions('name-asc')}
                            >
                              Name (A → Z)
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                              onClick={() => handleSortOptions('name-desc')}
                            >
                              Name (Z → A)
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                              onClick={() => handleSortOptions('price-asc')}
                            >
                              Price (Low → High)
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                              onClick={() => handleSortOptions('price-desc')}
                            >
                              Price (High → Low)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {filteredOptionAssignments.length === 0 && optionSearch ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No options match "{optionSearch}"
                  </p>
                ) : null}
                {filteredOptionAssignments.map((assignment, index) => (
                  <div
                    key={assignment.modifierOptionId}
                    draggable={!isDragDisabled}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-3 p-3 bg-muted/50 rounded-lg group transition-opacity",
                      dragIndex === index && "opacity-40",
                      dragOverIndex === index && dragIndex !== index && "ring-2 ring-primary ring-inset",
                    )}
                  >
                    <GripVertical
                      className={cn(
                        "w-4 h-4 text-muted-foreground shrink-0",
                        isDragDisabled
                          ? "opacity-30 cursor-not-allowed"
                          : "cursor-grab active:cursor-grabbing",
                      )}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div>
                        {draft.isSizeModifier ? (
                          <input
                            type="text"
                            value={assignment.option?.optionName ?? ''}
                            onChange={(e) => handleSizeNameChange(
                              assignment.modifierOptionId,
                              e.target.value,
                            )}
                            placeholder='Size name (e.g. Small, 10")'
                            className="input-field text-sm h-8 w-full font-medium"
                            aria-label="Size name"
                            autoFocus={!assignment.option?.optionName}
                          />
                        ) : (
                          <>
                            <span className="text-sm font-medium">
                              {assignment.option?.optionName || assignment.optionDisplayName}
                            </span>
                            <input
                              type="text"
                              value={assignment.optionDisplayName}
                              onChange={(e) => handleOptionDisplayNameChange(
                                assignment.modifierOptionId,
                                e.target.value,
                              )}
                              placeholder={`Display name (default: ${assignment.option?.optionName ?? ''})`}
                              className="input-field text-xs h-7 w-full mt-0.5"
                              aria-label="Option display name"
                            />
                          </>
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
                    <div className="flex items-center gap-2.5 shrink-0">
                      {isNoCharge ? (
                        <span className="text-xs text-muted-foreground italic">Free</span>
                      ) : (
                        <PriceStepperInput
                          value={assignment.maxLimit}
                          onFocus={(e) => e.target.select()}
                          onCommit={(v) => handleOptionPriceChange(assignment.modifierOptionId, v)}
                          prefix={<span className="text-muted-foreground text-xs">$</span>}
                          wrapperClassName="w-20"
                        />
                      )}
                      <div className="flex items-center gap-1" title="Max times a guest can select this option (0 = unlimited)">
                        <span className="text-muted-foreground text-xs">Qty</span>
                        <NumberStepperInput
                          inputMode="numeric"
                          value={assignment.maxQtyPerOption ?? 1}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleOptionQtyChange(
                            assignment.modifierOptionId,
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )}
                          onStep={(delta) => handleOptionQtyChange(
                            assignment.modifierOptionId,
                            Math.max(0, (assignment.maxQtyPerOption ?? 1) + delta)
                          )}
                          wrapperClassName="w-14"
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
                    {draft.isSizeModifier
                      ? 'No sizes added yet. Click "New Size" (or use bulk create) to add sizes and their prices.'
                      : 'No options added yet. Click "New Option" to create one.'}
                  </p>
                )}
              </div>

              {/* Bulk create — to the right of the options list */}
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
            </div>
          </div>}

          {/* Channel Visibility — On-Prem / Off-Prem split into two columns */}
          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
            <Label className="section-header">Channel Visibility</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(getChannelsByGroup()).map(([group, channels]) => {
                const isOpen = openChannelGroup === group;
                const active = channels.filter(c => draft[c.key as VisibilityChannelKey]);
                const triggerLabel =
                  active.length === 0 ? 'None' :
                  active.length === channels.length ? 'All' :
                  active.map(c => c.label).join(', ');
                return (
                  <div key={group}>
                    <button
                      type="button"
                      onClick={() => setOpenChannelGroup(isOpen ? null : group)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
                        isOpen ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50',
                      )}
                    >
                      <span className="font-medium text-foreground">{group}</span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className={cn(active.length > 0 && active.length < channels.length && 'text-primary')}>
                          {triggerLabel}
                        </span>
                        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-0.5 rounded-md border border-border divide-y divide-border overflow-hidden">
                        {channels.map(({ key, label }) => {
                          const checked = draft[key as VisibilityChannelKey];
                          return (
                            <label key={key} className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                              <span className={cn('text-xs', checked ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setDraft(d => toggleVisibilityChannel(d, key as VisibilityChannelKey))}
                                className="accent-primary cursor-pointer"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Min/Max Selection + Selection Behavior — 4 columns in one row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label className="section-header">Min Selection</Label>
              <NumberStepperInput
                inputMode="numeric"
                value={minSelectorField.value}
                // optional types lock min at 0; required types allow editing from 1 up to max
                disabled={draft.isOptional === 'Select any' || draft.isOptional === 'Push Optional'}
                onFocus={(e) => e.target.select()}
                onChange={(e) => minSelectorField.onChange(e.target.value)}
                onBlur={minSelectorField.onBlur}
                onStep={minSelectorField.step}
                wrapperClassName="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="section-header">Max Selection</Label>
              <NumberStepperInput
                inputMode="numeric"
                value={maxSelectorField.value}
                onFocus={(e) => e.target.select()}
                onChange={(e) => maxSelectorField.onChange(e.target.value)}
                onBlur={maxSelectorField.onBlur}
                onStep={maxSelectorField.step}
                disabled={draft.noMaxSelection}
                wrapperClassName="w-full"
              />
              <p className="text-[10px] text-muted-foreground">Combination limit</p>
              {isFinite(selectionCeiling) && (
                <p className="text-[10px] text-muted-foreground">Max {selectionCeiling} selections</p>
              )}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <Label className="text-[10px] text-muted-foreground">No maximum</Label>
                <Switch
                  checked={draft.noMaxSelection}
                  onCheckedChange={(checked) => setDraft(d => ({ ...d, noMaxSelection: checked }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded-md border border-border/60 bg-background/40">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="multiSelect" className="text-sm">Allow multiple selections</Label>
                <Switch
                  id="multiSelect"
                  checked={draft.multiSelect}
                  onCheckedChange={(checked) => setDraft(d => ({ ...d, multiSelect: checked }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Guest can pick more than one option from this modifier</p>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded-md border border-border/60 bg-background/40">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="canGuestSelectMoreModifiers" className="text-sm">Allow same option more than once</Label>
                <Switch
                  id="canGuestSelectMoreModifiers"
                  checked={draft.canGuestSelectMoreModifiers}
                  onCheckedChange={(checked) => setDraft(d => ({ ...d, canGuestSelectMoreModifiers: checked }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Guest can pick the same option multiple times</p>
            </div>
          </div>

          {/* Pizza & Size Settings + Selection Type + Pricing — one row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
            <div className="flex flex-col gap-1.5 p-3 rounded-md border border-border/60 bg-background/40">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pizzaSelection" className="text-sm">Pizza Selection</Label>
                <Switch
                  id="pizzaSelection"
                  checked={draft.pizzaSelection}
                  onCheckedChange={(checked) => setDraft(d => ({ ...d, pizzaSelection: checked }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Enable left/right/whole pizza topping selection</p>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded-md border border-border/60 bg-background/40">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="isSizeModifier" className="text-sm">Size Modifier</Label>
                <Switch
                  id="isSizeModifier"
                  checked={draft.isSizeModifier}
                  onCheckedChange={(checked) => {
                    setDraft(d => ({ ...d, isSizeModifier: checked }));
                    // Sizes are flat options — switch to flat mode so the options editor
                    // (where sizes + their prices are entered) is revealed.
                    if (checked && childModifiers.length === 0) setChosenMode('flat');
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">This modifier controls item size (e.g., 10", 14", 20")</p>
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder=" " />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__" className="text-muted-foreground/70">
                    &nbsp;
                  </SelectItem>
                  <SelectItem value="Select any">Optional (Select any)</SelectItem>
                  <SelectItem value="Required">Required</SelectItem>
                  <SelectItem value="Push Optional">Push (optional, popup)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pricing — how option prices are charged */}
            <div className="space-y-2">
              <Label className="section-header">Pricing</Label>
              <Select
                value={draft.modifierOptionPriceType || 'NoCharge'}
                onValueChange={(value) =>
                  setDraft((d) => ({ ...d, modifierOptionPriceType: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No charge" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NoCharge">No charge</SelectItem>
                  <SelectItem value="Individual">Individual pricing</SelectItem>
                  <SelectItem value="Group">Group pricing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-4 py-2.5 border-t border-border bg-panel-bg flex items-center justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleDeleteModifier}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
          <div className={cn("flex items-center gap-2 transition-opacity", hasChanges ? "opacity-100" : "opacity-40 pointer-events-none")}>
            <button
              onClick={handleDiscard}
              disabled={!hasChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || !maxSelectorValid || !isNamesValid}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
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
        noCharge={isNoCharge}
      />

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Modifier Group Detail Panel
// ---------------------------------------------------------------------------
interface ModifierGroupDetailProps {
  group: ModifierGroup;
  modifiers: Modifier[];
  updateModifierGroup: (id: number, updates: Partial<ModifierGroup>) => void;
  onDelete: () => void;
}

function ModifierGroupDetail({ group, modifiers, updateModifierGroup, onDelete }: ModifierGroupDetailProps) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(group.groupName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [editingPosName, setEditingPosName] = useState(false);
  const [draftPosName, setDraftPosName] = useState(group.posDisplayName);
  const [posNameError, setPosNameError] = useState<string | null>(null);
  const [modPickerOpen, setModPickerOpen] = useState(false);
  const [modPickerSearch, setModPickerSearch] = useState('');
  const modPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftName(group.groupName);
    setDraftPosName(group.posDisplayName);
    setEditingName(false);
    setEditingPosName(false);
    setNameError(null);
    setPosNameError(null);
  }, [group.id]);

  useLayoutEffect(() => {
    if (!modPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (modPickerRef.current && !modPickerRef.current.contains(e.target as Node)) {
        setModPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modPickerOpen]);

  const groupModifierIds = group.modifierIds
    ? group.modifierIds.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
    : [];
  const groupModifiers = groupModifierIds
    .map((id) => modifiers.find((m) => m.id === id))
    .filter(Boolean) as Modifier[];

  const availableModifiers = modifiers.filter(
    (m) =>
      !groupModifierIds.includes(m.id) &&
      (!modPickerSearch || m.modifierName.toLowerCase().includes(modPickerSearch.toLowerCase())),
  );

  const addModifierToGroup = (modId: number) => {
    const newIds = [...groupModifierIds, modId].join(',');
    updateModifierGroup(group.id, { modifierIds: newIds });
    setModPickerOpen(false);
    setModPickerSearch('');
  };

  const removeModifierFromGroup = (modId: number) => {
    const newIds = groupModifierIds.filter((id) => id !== modId).join(',');
    updateModifierGroup(group.id, { modifierIds: newIds });
  };

  const saveName = () => {
    const err = getGroupNameError(draftName);
    if (err) { setNameError(err); return; }
    setNameError(null);
    updateModifierGroup(group.id, { groupName: draftName.trim() });
    setEditingName(false);
  };

  const savePosName = () => {
    const err = getGroupPosNameError(draftPosName);
    if (err) { setPosNameError(err); return; }
    setPosNameError(null);
    updateModifierGroup(group.id, { posDisplayName: draftPosName.trim() || group.groupName });
    setEditingPosName(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="p-4 border-b border-panel-border flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div>
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => { setDraftName(e.target.value); setNameError(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveName();
                    if (e.key === 'Escape') { setEditingName(false); setNameError(null); }
                  }}
                  className="input-field text-sm font-semibold flex-1"
                />
                <button type="button" onClick={saveName} className="p-1 text-primary hover:text-primary/80">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => { setEditingName(false); setNameError(null); }} className="p-1 text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
              {nameError && <p className="text-[10px] text-destructive mt-0.5">{nameError}</p>}
            </div>
          ) : (
            <button
              type="button"
              className="group flex items-center gap-1.5 text-left w-full"
              onClick={() => setEditingName(true)}
            >
              <span className="font-semibold text-sm truncate">{group.groupName}</span>
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
            </button>
          )}
          <div className="text-[10px] text-muted-foreground mt-0.5">#{group.id}</div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete group"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* POS Display Name */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            POS Display Name
          </p>
          {editingPosName ? (
            <div>
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={draftPosName}
                  onChange={(e) => { setDraftPosName(e.target.value); setPosNameError(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') savePosName();
                    if (e.key === 'Escape') { setEditingPosName(false); setPosNameError(null); }
                  }}
                  className="input-field text-sm flex-1"
                />
                <button type="button" onClick={savePosName} className="p-1 text-primary hover:text-primary/80">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => { setEditingPosName(false); setPosNameError(null); }} className="p-1 text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
              {posNameError && <p className="text-[10px] text-destructive mt-0.5">{posNameError}</p>}
            </div>
          ) : (
            <button
              type="button"
              className="group flex items-center gap-1.5 text-left w-full text-sm"
              onClick={() => setEditingPosName(true)}
            >
              <span className="truncate">{group.posDisplayName || group.groupName}</span>
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
            </button>
          )}
        </div>

        {/* Modifiers in this group */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Modifiers ({groupModifiers.length})
          </p>
          {groupModifiers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {groupModifiers.map((mod) => (
                <span
                  key={mod.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-muted border-border text-foreground"
                >
                  {mod.modifierName}
                  <button
                    type="button"
                    onClick={() => removeModifierFromGroup(mod.id)}
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Add modifier picker */}
          <div className="relative" ref={modPickerRef}>
            <button
              type="button"
              onClick={() => {
                setModPickerOpen((o) => !o);
                setModPickerSearch('');
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
                modPickerOpen
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-muted/30 hover:bg-muted/50',
              )}
            >
              <span className="text-muted-foreground">Add modifier…</span>
              <ChevronRight
                className={cn(
                  'w-3.5 h-3.5 text-muted-foreground transition-transform',
                  modPickerOpen && 'rotate-90',
                )}
              />
            </button>
            {modPickerOpen && (
              <div className="absolute z-10 top-full mt-1 w-full rounded-md border border-border bg-background shadow-md">
                <div className="p-1.5 border-b border-border">
                  <input
                    type="text"
                    value={modPickerSearch}
                    onChange={(e) => setModPickerSearch(e.target.value)}
                    placeholder="Search modifiers…"
                    className="input-field h-7 text-xs w-full"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {availableModifiers.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      {modPickerSearch ? 'No matches' : 'All modifiers assigned'}
                    </p>
                  ) : (
                    availableModifiers.map((mod) => (
                      <button
                        key={mod.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                        onClick={() => addModifierToGroup(mod.id)}
                      >
                        <span>{mod.modifierName}</span>
                        <span className="text-muted-foreground/60">#{mod.id}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modifier Option & Pricing Overview (read-only)
// ---------------------------------------------------------------------------
interface ModifierOptionOverviewProps {
  modifiers: Modifier[];
  modifierOptions: ModifierOption[];
  modifierModifierOptions: ReturnType<typeof useMenuStore.getState>['modifierModifierOptions'];
  filter: string;
  setFilter: (v: string) => void;
}

const OVERVIEW_ROW_CAP = 1000;

function ModifierOptionOverview({
  modifiers,
  modifierOptions,
  modifierModifierOptions,
  filter,
  setFilter,
}: ModifierOptionOverviewProps) {
  const rows = useMemo(() => {
    return modifierModifierOptions.map((mmo) => {
      const modifier = modifiers.find((m) => m.id === mmo.modifierId);
      const option = modifierOptions.find((o) => o.id === mmo.modifierOptionId);
      return {
        key: `${mmo.modifierId}-${mmo.modifierOptionId}`,
        modifierName: modifier?.modifierName ?? `#${mmo.modifierId}`,
        optionName: option?.optionName ?? `#${mmo.modifierOptionId}`,
        displayName: mmo.optionDisplayName || option?.optionName || '',
        price: mmo.maxLimit ?? 0,
        qty: mmo.maxQtyPerOption ?? 1,
        isDefault: mmo.isDefaultSelected,
      };
    });
  }, [modifierModifierOptions, modifiers, modifierOptions]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.modifierName.toLowerCase().includes(q) ||
        r.optionName.toLowerCase().includes(q) ||
        r.displayName.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const cappedRows = filteredRows.slice(0, OVERVIEW_ROW_CAP);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-panel-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Option & Pricing Overview</h2>
          <span className="text-xs text-muted-foreground">
            {filteredRows.length} assignment{filteredRows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by modifier, option, or display name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {filteredRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? 'No modifier options assigned yet.' : `No assignments match "${filter}"`}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-panel-bg z-10">
              <tr className="text-left text-xs text-muted-foreground border-b border-panel-border">
                <th className="px-4 py-2 font-medium">Modifier</th>
                <th className="px-4 py-2 font-medium">Option</th>
                <th className="px-4 py-2 font-medium">Display name</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
                <th className="px-4 py-2 font-medium text-center">Qty</th>
                <th className="px-4 py-2 font-medium text-center">Default</th>
              </tr>
            </thead>
            <tbody>
              {cappedRows.map((r) => (
                <tr key={r.key} className="border-b border-border/50 hover:bg-item-hover">
                  <td className="px-4 py-2 font-medium text-foreground">{r.modifierName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.optionName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.displayName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${r.price.toFixed(2)}</td>
                  <td className="px-4 py-2 text-center tabular-nums">{r.qty === 0 ? '∞' : r.qty}</td>
                  <td className="px-4 py-2 text-center">
                    {r.isDefault ? (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filteredRows.length > OVERVIEW_ROW_CAP && (
          <div className="p-3 text-center text-xs text-muted-foreground">
            Showing first {OVERVIEW_ROW_CAP} of {filteredRows.length} assignments. Use the filter to narrow results.
          </div>
        )}
      </div>
    </div>
  );
}
