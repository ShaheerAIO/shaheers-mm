import { useState, useMemo, useEffect } from 'react';
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
      isOptional: 'Select any',
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
                    {modifier.onPrem && <span className="bg-green-500/10 text-green-600 px-1 rounded">On</span>}
                    {modifier.offPrem && <span className="bg-blue-500/10 text-blue-600 px-1 rounded">Off</span>}
                  </div>
                  </button>
                  <button
                    type="button"
                    title="Delete modifier"
                    className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        !window.confirm(
                          `Delete modifier "${modifier.modifierName}"? This cannot be undone.`,
                        )
                      ) {
                        return;
                      }
                      deleteModifier(modifier.id);
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
    </>
  );
}

interface ModifierDetailProps {
  modifier: Modifier;
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
  /** Which nested child modifier rows are expanded to show their options */
  const [expandedNestedChildIds, setExpandedNestedChildIds] = useState<number[]>([]);
  const [posDisplayMode, setPosDisplayMode] = useState<'match_modifier' | 'custom_pos'>('match_modifier');

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
  });

  // Reset draft when modifier changes
  useEffect(() => {
    const nm = modifier.modifierName?.trim() ?? '';
    const pos = modifier.posDisplayName?.trim() ?? '';
    setPosDisplayMode(!pos || pos === nm ? 'match_modifier' : 'custom_pos');
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
    });
    setOptionSearch('');
    setExpandedNestedChildIds([]);
  }, [modifier.id]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    return (
      draft.modifierName !== modifier.modifierName ||
      draft.posDisplayName !== modifier.posDisplayName ||
      draft.prefix !== (modifier.prefix ?? '') ||
      draft.onPrem !== modifier.onPrem ||
      draft.offPrem !== modifier.offPrem ||
      draft.minSelector !== modifier.minSelector ||
      draft.maxSelector !== modifier.maxSelector ||
      draft.noMaxSelection !== modifier.noMaxSelection ||
      draft.isOptional !== modifier.isOptional ||
      draft.pizzaSelection !== modifier.pizzaSelection ||
      draft.isSizeModifier !== modifier.isSizeModifier
    );
  }, [draft, modifier]);

  const handleSave = () => {
    updateModifier(modifier.id, {
      modifierName: draft.modifierName,
      posDisplayName:
        posDisplayMode === 'match_modifier'
          ? draft.modifierName.trim()
          : draft.posDisplayName.trim() || draft.modifierName.trim(),
      prefix: draft.prefix.trim(),
      onPrem: draft.onPrem,
      offPrem: draft.offPrem,
      minSelector: draft.minSelector,
      maxSelector: draft.maxSelector,
      noMaxSelection: draft.noMaxSelection,
      isOptional: draft.isOptional,
      pizzaSelection: draft.pizzaSelection,
      isSizeModifier: draft.isSizeModifier,
    });
  };

  const handleDiscard = () => {
    const nm = modifier.modifierName?.trim() ?? '';
    const pos = modifier.posDisplayName?.trim() ?? '';
    setPosDisplayMode(!pos || pos === nm ? 'match_modifier' : 'custom_pos');
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
    });
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

  const handleAddOption = (optionId: string) => {
    const id = parseInt(optionId);
    if (isNaN(id)) return;
    
    const option = modifierOptions.find(o => o.id === id);
    if (!option) return;
    
    addModifierModifierOption({
      modifierId: modifier.id,
      modifierOptionId: id,
      isDefaultSelected: false,
      maxLimit: 0,
      optionDisplayName: option.optionName,
      sortOrder: modifierOptionAssignments.length,
    });
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
    });
  };

  const handleOptionPriceChange = (optionId: number, maxLimit: number) => {
    updateModifierModifierOption(modifier.id, optionId, { maxLimit });
  };

  const handleRemoveOption = (optionId: number) => {
    removeModifierModifierOption(modifier.id, optionId);
  };

  const handleDeleteOptionGlobally = (optionId: number, label: string) => {
    const usage = modifierModifierOptions.filter((mmo) => mmo.modifierOptionId === optionId).length;
    const name = label.trim() || 'This option';
    const msg =
      usage > 1
        ? `${name} is linked to ${usage} modifiers. Delete it from the library everywhere?`
        : `Delete ${name} from the library? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    deleteModifierOption(optionId);
  };

  const handleDeleteModifier = () => {
    if (
      !window.confirm(
        `Delete modifier "${modifier.modifierName}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    deleteModifier(modifier.id);
    setSelectedModifier(null);
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
          {/* Names */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="section-header">Modifier name</Label>
              <p className="text-xs text-muted-foreground">
                Internal / menu-builder name (reports, Excel, library).
              </p>
              <input
                type="text"
                value={draft.modifierName}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft(d => ({
                    ...d,
                    modifierName: v,
                    posDisplayName: posDisplayMode === 'match_modifier' ? v : d.posDisplayName,
                  }));
                }}
                className="input-field text-xl font-semibold w-full"
                placeholder="Modifier name"
              />
            </div>
            <div className="space-y-2">
              <Label className="section-header">POS display name</Label>
              <Select
                value={posDisplayMode}
                onValueChange={(v: 'match_modifier' | 'custom_pos') => {
                  setPosDisplayMode(v);
                  if (v === 'match_modifier') {
                    setDraft(d => ({ ...d, posDisplayName: d.modifierName }));
                  } else {
                    setDraft(d => ({
                      ...d,
                      posDisplayName: d.posDisplayName.trim() ? d.posDisplayName : d.modifierName,
                    }));
                  }
                }}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match_modifier">Same as modifier name</SelectItem>
                  <SelectItem value="custom_pos">Custom POS name</SelectItem>
                </SelectContent>
              </Select>
              {posDisplayMode === 'custom_pos' && (
                <input
                  type="text"
                  value={draft.posDisplayName}
                  onChange={(e) => setDraft(d => ({ ...d, posDisplayName: e.target.value }))}
                  className="input-field w-full max-w-md text-sm"
                  placeholder="Shown on POS / guest-facing UI"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lib-mod-prefix" className="section-header">Prefix (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Short label on tickets or kitchen display.
              </p>
              <input
                id="lib-mod-prefix"
                type="text"
                value={draft.prefix}
                onChange={(e) => setDraft(d => ({ ...d, prefix: e.target.value }))}
                className="input-field w-full max-w-md text-sm"
                placeholder="e.g., TOP, SIDE"
              />
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

          {/* Modifier Type — mode selector (when empty) or locked indicator */}
          <div className="space-y-2">
            <Label className="section-header">Modifier Type</Label>
            {effectiveMode === null ? (
              // Nothing saved yet — let user choose
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChosenMode('flat')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                    chosenMode === 'flat'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  <List className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs">Flat Options</div>
                    <div className="text-[10px] font-normal opacity-70 leading-tight">Guest picks from a list</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setChosenMode('nested')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                    chosenMode === 'nested'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  <GitBranch className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs">Nested Modifiers</div>
                    <div className="text-[10px] font-normal opacity-70 leading-tight">Container for sub-modifiers</div>
                  </div>
                </button>
              </div>
            ) : (
              // Mode is locked by existing data
              <div className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs',
                effectiveMode === 'flat'
                  ? 'bg-primary/5 border-primary/20 text-primary'
                  : 'bg-primary/5 border-primary/20 text-primary',
              )}>
                {effectiveMode === 'flat'
                  ? <List className="w-3.5 h-3.5 shrink-0" />
                  : <GitBranch className="w-3.5 h-3.5 shrink-0" />}
                <div className="flex-1">
                  <span className="font-semibold">
                    {effectiveMode === 'flat' ? 'Flat Options' : 'Nested Modifiers'}
                  </span>
                  <span className="text-muted-foreground ml-1.5">
                    {effectiveMode === 'flat'
                      ? '— remove all options to switch to Nested'
                      : '— remove all nested modifiers to switch to Flat'}
                  </span>
                </div>
              </div>
            )}
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
                          {child.onPrem && (
                            <span className="bg-green-500/10 text-green-600 px-1 rounded">On</span>
                          )}
                          {child.offPrem && (
                            <span className="bg-blue-500/10 text-blue-600 px-1 rounded">Off</span>
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
            <div className="flex items-center justify-between">
              <Label className="section-header">Options ({modifierOptionAssignments.length})</Label>
              <div className="flex gap-2">
                {availableOptions.length > 0 && (
                  <Select onValueChange={handleAddOption}>
                    <SelectTrigger className="w-32">
                      <span className="text-xs">Add Existing</span>
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
                      {availableOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          <span className="line-clamp-2 text-left whitespace-normal">
                            {formatModifierOptionForSelect(option)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <button className="btn-add" onClick={() => setShowCreateOption(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  New Option
                </button>
              </div>
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
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">$</span>
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

          {/* Channel Availability (onPrem/offPrem) */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <Label className="section-header">Channel Availability</Label>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="onPrem" className="text-sm">On-Premise (Dine-in)</Label>
                <p className="text-xs text-muted-foreground">Show for in-house orders</p>
              </div>
              <Switch
                id="onPrem"
                checked={draft.onPrem}
                onCheckedChange={(checked) => setDraft(d => ({ ...d, onPrem: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="offPrem" className="text-sm">Off-Premise (Delivery/Pickup)</Label>
                <p className="text-xs text-muted-foreground">Show for online/delivery orders</p>
              </div>
              <Switch
                id="offPrem"
                checked={draft.offPrem}
                onCheckedChange={(checked) => setDraft(d => ({ ...d, offPrem: checked }))}
              />
            </div>
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

          {/* Optional / Required */}
          <div className="space-y-2">
            <Label className="section-header">Selection Type</Label>
            <Select 
              value={draft.isOptional} 
              onValueChange={(value) => setDraft(d => ({ ...d, isOptional: value }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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

      {/* Create Option Modal */}
      <CreateOptionModal
        isOpen={showCreateOption}
        onClose={() => setShowCreateOption(false)}
        onSave={handleCreateOption}
      />
    </>
  );
}
