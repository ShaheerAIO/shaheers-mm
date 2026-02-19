import { useState, useMemo, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Plus, GripVertical, Trash2, Upload, Search, X, Save, RotateCcw, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function ModifierLibraryContent() {
  const { 
    modifiers, 
    modifierOptions,
    modifierModifierOptions,
    selectedModifierId, 
    setSelectedModifier,
    addModifier,
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
      m.posDisplayName.toLowerCase().includes(query)
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
        <div className="w-64 border-r border-panel-border bg-panel-bg flex flex-col">
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
              const optionCount = modifierModifierOptions.filter(
                mmo => mmo.modifierId === modifier.id
              ).length;
              
              return (
                <div
                  key={modifier.id}
                  onClick={() => setSelectedModifier(modifier.id)}
                  className={cn(
                    "px-4 py-3 cursor-pointer border-b border-panel-border transition-colors",
                    "hover:bg-item-hover",
                    selectedModifierId === modifier.id && "bg-item-selected border-l-2 border-l-primary"
                  )}
                >
                  <div className="font-medium text-sm">{modifier.modifierName}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{optionCount} options</span>
                    {modifier.onPrem && <span className="bg-green-500/10 text-green-600 px-1 rounded">On</span>}
                    {modifier.offPrem && <span className="bg-blue-500/10 text-blue-600 px-1 rounded">Off</span>}
                  </div>
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
  onPrem: boolean;
  offPrem: boolean;
  minSelector: number;
  maxSelector: number;
  noMaxSelection: boolean;
  isOptional: string;
}

function ModifierDetail({ modifier }: ModifierDetailProps) {
  const { 
    updateModifier,
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
  
  // Draft state for modifier fields
  const [draft, setDraft] = useState<ModifierDraft>({
    modifierName: modifier.modifierName,
    posDisplayName: modifier.posDisplayName,
    onPrem: modifier.onPrem,
    offPrem: modifier.offPrem,
    minSelector: modifier.minSelector,
    maxSelector: modifier.maxSelector,
    noMaxSelection: modifier.noMaxSelection,
    isOptional: modifier.isOptional,
  });

  // Reset draft when modifier changes
  useEffect(() => {
    setDraft({
      modifierName: modifier.modifierName,
      posDisplayName: modifier.posDisplayName,
      onPrem: modifier.onPrem,
      offPrem: modifier.offPrem,
      minSelector: modifier.minSelector,
      maxSelector: modifier.maxSelector,
      noMaxSelection: modifier.noMaxSelection,
      isOptional: modifier.isOptional,
    });
    setOptionSearch('');
  }, [modifier.id]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    return (
      draft.modifierName !== modifier.modifierName ||
      draft.posDisplayName !== modifier.posDisplayName ||
      draft.onPrem !== modifier.onPrem ||
      draft.offPrem !== modifier.offPrem ||
      draft.minSelector !== modifier.minSelector ||
      draft.maxSelector !== modifier.maxSelector ||
      draft.noMaxSelection !== modifier.noMaxSelection ||
      draft.isOptional !== modifier.isOptional
    );
  }, [draft, modifier]);

  const handleSave = () => {
    updateModifier(modifier.id, {
      modifierName: draft.modifierName,
      posDisplayName: draft.posDisplayName,
      onPrem: draft.onPrem,
      offPrem: draft.offPrem,
      minSelector: draft.minSelector,
      maxSelector: draft.maxSelector,
      noMaxSelection: draft.noMaxSelection,
      isOptional: draft.isOptional,
    });
  };

  const handleDiscard = () => {
    setDraft({
      modifierName: modifier.modifierName,
      posDisplayName: modifier.posDisplayName,
      onPrem: modifier.onPrem,
      offPrem: modifier.offPrem,
      minSelector: modifier.minSelector,
      maxSelector: modifier.maxSelector,
      noMaxSelection: modifier.noMaxSelection,
      isOptional: modifier.isOptional,
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
    return childModifierIds
      .map(id => modifiers.find(m => m.id === id))
      .filter((m): m is Modifier => m !== undefined);
  }, [childModifierIds, modifiers]);

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
          {/* Name */}
          <div className="space-y-2">
            <Label className="section-header">Modifier Name</Label>
            <input
              type="text"
              value={draft.modifierName}
              onChange={(e) => setDraft(d => ({ 
                ...d, 
                modifierName: e.target.value,
                posDisplayName: e.target.value 
              }))}
              className="input-field text-xl font-semibold w-full"
              placeholder="Modifier name"
            />
          </div>

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
              <Label className="section-header">No Max</Label>
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

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="section-header">Options ({modifierOptionAssignments.length})</Label>
              <div className="flex gap-2">
                {availableOptions.length > 0 && (
                  <Select onValueChange={handleAddOption}>
                    <SelectTrigger className="w-32">
                      <span className="text-xs">Add Existing</span>
                    </SelectTrigger>
                    <SelectContent>
                      {availableOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.optionName}
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
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      {assignment.option?.optionName || assignment.optionDisplayName}
                    </span>
                    {assignment.isDefaultSelected && (
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                    {assignment.option && !assignment.option.isStockAvailable && (
                      <span className="ml-2 text-xs bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">
                        Out of Stock
                      </span>
                    )}
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
                  <button 
                    onClick={() => handleRemoveOption(assignment.modifierOptionId)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {modifierOptionAssignments.length === 0 && !optionSearch && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No options added yet. Click "New Option" to create one.
                </p>
              )}
            </div>
          </div>

          {/* Nested Modifiers */}
          <div className="space-y-3 pt-4 border-t border-border">
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
                  <SelectContent>
                    {availableNestedModifiers.map((mod) => (
                      <SelectItem key={mod.id} value={mod.id.toString()}>
                        {mod.modifierName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Nested modifiers appear after the guest selects an option from this modifier.
            </p>
            <div className="space-y-2">
              {childModifiers.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{child.modifierName}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>
                        {modifierModifierOptions.filter(mmo => mmo.modifierId === child.id).length} options
                      </span>
                      {child.onPrem && (
                        <span className="bg-green-500/10 text-green-600 px-1 rounded">On</span>
                      )}
                      {child.offPrem && (
                        <span className="bg-blue-500/10 text-blue-600 px-1 rounded">Off</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveNestedModifier(child.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove nested modifier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {childModifiers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No nested modifiers. Use the dropdown above to add one.
                </p>
              )}
            </div>
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
