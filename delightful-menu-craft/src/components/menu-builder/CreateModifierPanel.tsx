import { useState, useMemo, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { X, Plus, Trash2, Save, Check, GitBranch, List } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { Modifier, ModifierOption } from '@/types/menu';
import { formatModifierForSelect, formatModifierOptionForSelect } from '@/lib/modifierLabels';

interface CreateModifierPanelProps {
  itemId: number;
}

type OptionDraft = {
  id: string; // temporary ID for React key
  type: 'existing' | 'new';
  optionName: string;
  posDisplayName: string;
  price: number;
  isDefaultSelected: boolean;
} & (
  | { type: 'existing'; existingOptionId: number }
  | { type: 'new'; isStockAvailable: boolean; isSizeModifier: boolean }
);

export function CreateModifierPanel({ itemId }: CreateModifierPanelProps) {
  const {
    setIsCreatingModifier,
    setIsCreatingOption,
    pendingOption,
    setPendingOption,
    modifiers,
    modifierOptions,
    modifierModifierOptions,
    itemModifiers,
    addModifier,
    updateModifier,
    addModifierOption,
    addModifierModifierOption,
    addItemModifier,
    getNextId,
  } = useMenuStore();

  // Modifier fields
  const [modifierName, setModifierName] = useState('');
  const [posDisplayName, setPosDisplayName] = useState('');
  /** Match modifier name vs separate POS label */
  const [posDisplayMode, setPosDisplayMode] = useState<'match_modifier' | 'custom_pos'>('match_modifier');
  const [prefix, setPrefix] = useState('');
  const [minSelector, setMinSelector] = useState(0);
  const [maxSelector, setMaxSelector] = useState(1);
  const [noMaxSelection, setNoMaxSelection] = useState(false);
  const [isOptional, setIsOptional] = useState('Select any');
  const [onPrem, setOnPrem] = useState(true);
  const [offPrem, setOffPrem] = useState(true);
  const [pizzaSelection, setPizzaSelection] = useState(false);
  const [isSizeModifier, setIsSizeModifier] = useState(false);

  // Modifier type mode — mutually exclusive
  type ModifierMode = 'flat' | 'nested';
  const [modifierMode, setModifierMode] = useState<ModifierMode>('flat');

  // Options being added to this modifier
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [showSaveNotification, setShowSaveNotification] = useState(false);

  // Nested modifier IDs selected during creation
  const [nestedModifierIds, setNestedModifierIds] = useState<number[]>([]);

  // Modifiers available to nest (not already parented elsewhere)
  const availableNestedModifiers = useMemo(() => {
    return modifiers.filter(m =>
      !nestedModifierIds.includes(m.id) &&
      (m.parentModifierId === 0)
    );
  }, [modifiers, nestedModifierIds]);

  const nestedModifiersList = useMemo(() => {
    return nestedModifierIds
      .map(id => modifiers.find(m => m.id === id))
      .filter((m): m is Modifier => m !== undefined);
  }, [nestedModifierIds, modifiers]);

  // Auto-set minSelector to 1 when "Required" is selected
  useEffect(() => {
    if (isOptional === 'Required' && minSelector === 0) {
      setMinSelector(1);
    }
  }, [isOptional, minSelector]);

  useEffect(() => {
    if (posDisplayMode === 'match_modifier') {
      setPosDisplayName(modifierName);
    }
  }, [modifierName, posDisplayMode]);

  // Watch for pending option from CreateOptionPanel
  useEffect(() => {
    if (pendingOption) {
      const option: OptionDraft = {
        id: `new-${Date.now()}`,
        type: 'new',
        optionName: pendingOption.optionName,
        posDisplayName: pendingOption.posDisplayName,
        price: 0,
        isDefaultSelected: false,
        isStockAvailable: pendingOption.isStockAvailable,
        isSizeModifier: pendingOption.isSizeModifier,
      };

      setOptions(prev => [...prev, option]);
      setPendingOption(null); // Clear the pending option
    }
  }, [pendingOption, setPendingOption]);

  // Get available options (not yet added to this modifier)
  const availableOptions = useMemo(() => {
    const addedOptionIds = options
      .filter(opt => opt.type === 'existing')
      .map(opt => (opt as Extract<OptionDraft, { type: 'existing' }>).existingOptionId);

    return modifierOptions.filter(o => !addedOptionIds.includes(o.id));
  }, [modifierOptions, options]);

  // Get existing item modifiers count for sort order
  const itemModifiersCount = useMemo(() => {
    return itemModifiers.filter(im => im.itemId === itemId).length;
  }, [itemModifiers, itemId]);

  const handleAddExistingOption = (optionId: string) => {
    const id = parseInt(optionId);
    if (isNaN(id)) return;

    const option = modifierOptions.find(o => o.id === id);
    if (!option) return;

    const newOption: OptionDraft = {
      id: `existing-${id}-${Date.now()}`,
      type: 'existing',
      existingOptionId: id,
      optionName: option.optionName,
      posDisplayName: option.posDisplayName,
      price: 0,
      isDefaultSelected: false,
    };

    setOptions([...options, newOption]);
  };

  const handleCreateNewOption = () => {
    setIsCreatingOption(true);
  };

  const handleOptionCreated = (newOption: {
    optionName: string;
    posDisplayName: string;
    isStockAvailable: boolean;
    isSizeModifier: boolean;
  }) => {
    const option: OptionDraft = {
      id: `new-${Date.now()}`,
      type: 'new',
      optionName: newOption.optionName,
      posDisplayName: newOption.posDisplayName,
      price: 0,
      isDefaultSelected: false,
      isStockAvailable: newOption.isStockAvailable,
      isSizeModifier: newOption.isSizeModifier,
    };

    setOptions([...options, option]);
    setIsCreatingOption(false);
  };

  const handleRemoveOption = (optionId: string) => {
    setOptions(options.filter(opt => opt.id !== optionId));
  };

  const handleOptionPriceChange = (optionId: string, price: number) => {
    setOptions(
      options.map(opt =>
        opt.id === optionId ? { ...opt, price } : opt
      )
    );
  };

  const handleOptionDefaultChange = (optionId: string, isDefault: boolean) => {
    setOptions(
      options.map(opt =>
        opt.id === optionId ? { ...opt, isDefaultSelected: isDefault } : opt
      )
    );
  };

  const handleSave = () => {
    // Validation
    if (!modifierName.trim()) {
      alert('Modifier name is required');
      return;
    }
    if (modifierMode === 'flat' && options.length === 0) {
      alert('At least one option is required');
      return;
    }
    if (modifierMode === 'nested' && nestedModifierIds.length === 0) {
      alert('At least one nested modifier is required');
      return;
    }

    // 1. Create the new modifier
    const newModifierId = getNextId('modifiers');
    const newModifier: Modifier = {
      id: newModifierId,
      modifierName: modifierName.trim(),
      posDisplayName:
        posDisplayMode === 'match_modifier'
          ? modifierName.trim()
          : posDisplayName.trim() || modifierName.trim(),
      minSelector,
      maxSelector,
      noMaxSelection,
      isOptional,
      onPrem,
      offPrem,
      // Default values for other required fields
      isNested: false,
      addNested: false,
      modifierOptionPriceType: 'NoCharge',
      canGuestSelectMoreModifiers: true,
      multiSelect: false,
      limitIndividualModifierSelection: false,
      prefix: prefix.trim(),
      pizzaSelection,
      price: 0,
      parentModifierId: 0,
      modifierIds: '',
      isSizeModifier,
    };
    addModifier(newModifier);

    // 2. Create new options and link all options to modifier
    options.forEach((opt, index) => {
      let optionId: number;

      if (opt.type === 'existing') {
        optionId = opt.existingOptionId;
      } else {
        // Create new option
        optionId = getNextId('modifierOptions');
        const newOption: ModifierOption = {
          id: optionId,
          optionName: opt.optionName,
          posDisplayName: opt.posDisplayName,
          parentModifierId: newModifierId,
          isStockAvailable: opt.isStockAvailable,
          isSizeModifier: opt.isSizeModifier,
        };
        addModifierOption(newOption);
      }

      // Link option to modifier
      addModifierModifierOption({
        modifierId: newModifierId,
        modifierOptionId: optionId,
        isDefaultSelected: opt.isDefaultSelected,
        maxLimit: opt.price,
        optionDisplayName: opt.posDisplayName.trim() || opt.optionName,
        sortOrder: index,
      });
    });

    // 3. Set up nested modifiers (only in nested mode)
    if (modifierMode === 'nested' && nestedModifierIds.length > 0) {
      const modifierIdsStr = nestedModifierIds.join(',');
      updateModifier(newModifierId, {
        modifierIds: modifierIdsStr,
        addNested: true,
      });
      nestedModifierIds.forEach(childId => {
        updateModifier(childId, {
          parentModifierId: newModifierId,
          isNested: true,
        });
      });
    }

    // 4. Add modifier to the item
    addItemModifier({
      modifierId: newModifierId,
      itemId: itemId,
      sortOrder: itemModifiersCount,
    });

    // 5. Show save notification
    setShowSaveNotification(true);
    setTimeout(() => {
      setShowSaveNotification(false);
      // Close and reset after notification
      setIsCreatingModifier(false);
      resetForm();
    }, 2000);
  };

  const handleCancel = () => {
    setIsCreatingModifier(false);
    resetForm();
  };

  const resetForm = () => {
    setModifierName('');
    setPosDisplayName('');
    setPosDisplayMode('match_modifier');
    setPrefix('');
    setMinSelector(0);
    setMaxSelector(1);
    setNoMaxSelection(false);
    setIsOptional('Select any');
    setOnPrem(true);
    setOffPrem(true);
    setPizzaSelection(false);
    setIsSizeModifier(false);
    setOptions([]);
    setNestedModifierIds([]);
    setModifierMode('flat');
  };

  const isValid =
    modifierName.trim().length > 0 &&
    (modifierMode === 'flat' ? options.length > 0 : nestedModifierIds.length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 sm:px-4 border-b border-panel-border flex-shrink-0">
        <h3 className="font-semibold text-sm sm:text-base">Create Modifier</h3>
        <button
          onClick={handleCancel}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 space-y-5 scrollbar-thin">
        {/* Required name — always visible */}
        <div className="space-y-2">
          <Label className="section-header">Modifier name *</Label>
          <p className="text-xs text-muted-foreground">
            Internal name (reports, Excel, library). POS and ticket labels are in the section below.
          </p>
          <input
            type="text"
            value={modifierName}
            onChange={(e) => setModifierName(e.target.value)}
            className="input-field text-base sm:text-lg font-semibold w-full"
            placeholder="e.g., Toppings, Size, Add-ons"
            autoFocus
          />
        </div>

        {/* Flat vs nested — compact toggle buttons */}
        <div className="space-y-1.5">
          <Label className="section-header">Structure</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setModifierMode('flat');
                setNestedModifierIds([]);
              }}
              className={cn(
                'flex items-start gap-2 px-2 py-2 rounded-lg border text-left transition-colors',
                modifierMode === 'flat'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              <List className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-semibold text-[11px] leading-tight">Flat options</div>
                <div className="text-[9px] font-normal opacity-80 leading-snug mt-0.5">
                  List of choices
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setModifierMode('nested');
                setOptions([]);
              }}
              className={cn(
                'flex items-start gap-2 px-2 py-2 rounded-lg border text-left transition-colors',
                modifierMode === 'nested'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              <GitBranch className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-semibold text-[11px] leading-tight">Nested</div>
                <div className="text-[9px] font-normal opacity-80 leading-snug mt-0.5">
                  Sub-modifiers
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* POS / ticket naming — collapsible; uses Selects inside */}
        <Accordion
          type="multiple"
          defaultValue={[]}
          className="rounded-lg border border-border bg-muted/10 overflow-hidden"
        >
          <AccordionItem value="pos-labels" className="border-b border-border px-3">
            <AccordionTrigger className="py-2.5 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              POS & ticket labels
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">POS display name</Label>
                  <Select
                    value={posDisplayMode}
                    onValueChange={(v: 'match_modifier' | 'custom_pos') => {
                      setPosDisplayMode(v);
                      if (v === 'match_modifier') {
                        setPosDisplayName(modifierName);
                      } else {
                        setPosDisplayName((prev) => (prev.trim() ? prev : modifierName));
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
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
                      value={posDisplayName}
                      onChange={(e) => setPosDisplayName(e.target.value)}
                      className="input-field w-full text-sm"
                      placeholder="Guest-facing POS label"
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modPrefix" className="text-xs text-muted-foreground">
                    Ticket / KDS prefix (optional)
                  </Label>
                  <input
                    id="modPrefix"
                    type="text"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="input-field w-full text-sm"
                    placeholder="e.g. TOP, SIDE"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="channels-product" className="border-b border-border px-3">
            <AccordionTrigger className="py-2.5 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Channels & product
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label htmlFor="onPrem" className="text-sm">On-premise</Label>
                    <p className="text-[10px] text-muted-foreground">Dine-in orders</p>
                  </div>
                  <Switch id="onPrem" checked={onPrem} onCheckedChange={setOnPrem} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label htmlFor="offPrem" className="text-sm">Off-premise</Label>
                    <p className="text-[10px] text-muted-foreground">Delivery / pickup</p>
                  </div>
                  <Switch id="offPrem" checked={offPrem} onCheckedChange={setOffPrem} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label htmlFor="pizzaSelection" className="text-sm">Pizza selection</Label>
                    <p className="text-[10px] text-muted-foreground">Left / right / whole</p>
                  </div>
                  <Switch
                    id="pizzaSelection"
                    checked={pizzaSelection}
                    onCheckedChange={setPizzaSelection}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Label htmlFor="isSizeModifier" className="text-sm">Size modifier</Label>
                    <p className="text-[10px] text-muted-foreground">e.g. 10&quot;, 14&quot;, 20&quot;</p>
                  </div>
                  <Switch
                    id="isSizeModifier"
                    checked={isSizeModifier}
                    onCheckedChange={setIsSizeModifier}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="selection-rules" className="border-b-0 px-3">
            <AccordionTrigger className="py-2.5 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Selection rules
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Min</Label>
                    <input
                      type="number"
                      min={0}
                      value={minSelector}
                      onChange={(e) => setMinSelector(parseInt(e.target.value) || 0)}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Max</Label>
                    <input
                      type="number"
                      min={1}
                      value={maxSelector}
                      onChange={(e) => setMaxSelector(parseInt(e.target.value) || 1)}
                      disabled={noMaxSelection}
                      className="input-field w-full text-sm disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">No max</Label>
                    <div className="flex h-9 items-center">
                      <Switch checked={noMaxSelection} onCheckedChange={setNoMaxSelection} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="section-header text-xs">Selection type</Label>
                  <Select value={isOptional} onValueChange={setIsOptional}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Select any">Optional (select any)</SelectItem>
                      <SelectItem value="Required">Required</SelectItem>
                      <SelectItem value="Select one">Select one</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Options — flat mode only */}
        {modifierMode === 'flat' && <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="section-header">
              Options ({options.length}) *
            </Label>
            <div className="flex gap-2">
              {availableOptions.length > 0 && (
                <Select onValueChange={handleAddExistingOption}>
                  <SelectTrigger className="w-[min(100%,11rem)] min-w-[8rem]">
                    <span className="text-xs truncate">Add Existing</span>
                  </SelectTrigger>
                  <SelectContent className="max-w-[min(100vw-2rem,26rem)]">
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
              <button className="btn-add" onClick={handleCreateNewOption}>
                <Plus className="w-3.5 h-3.5" />
                New Option
              </button>
            </div>
          </div>

          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
              No options added yet. Add at least one option to continue.
            </p>
          ) : (
            <div className="space-y-2">
              {options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                >
                  <div className="flex-1">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{option.optionName}</span>
                        {option.type === 'new' && (
                          <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
                            New
                          </span>
                        )}
                      </div>
                      {option.posDisplayName.trim() &&
                        option.posDisplayName.trim() !== option.optionName && (
                          <span className="text-xs text-muted-foreground">
                            POS: {option.posDisplayName}
                          </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={option.price}
                        onChange={(e) =>
                          handleOptionPriceChange(option.id, parseFloat(e.target.value) || 0)
                        }
                        className="input-field w-20 text-sm"
                        placeholder="0.00"
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                        <input
                          type="checkbox"
                          checked={option.isDefaultSelected}
                          onChange={(e) =>
                            handleOptionDefaultChange(option.id, e.target.checked)
                          }
                          className="rounded"
                        />
                        Default
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveOption(option.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* Nested Modifiers — nested mode only */}
        {modifierMode === 'nested' && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/5 p-3">
          <div className="flex items-center justify-between">
            <Label className="section-header flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Nested Modifiers ({nestedModifierIds.length})
            </Label>
            {availableNestedModifiers.length > 0 && (
              <Select onValueChange={(val) => {
                const id = parseInt(val);
                if (!isNaN(id) && !nestedModifierIds.includes(id)) {
                  setNestedModifierIds([...nestedModifierIds, id]);
                }
              }}>
                <SelectTrigger className="w-[min(100%,11rem)] min-w-[8rem]">
                  <span className="text-xs flex items-center gap-1 truncate">
                    <Plus className="w-3 h-3 shrink-0" />
                    Add Nested
                  </span>
                </SelectTrigger>
                <SelectContent className="max-w-[min(100vw-2rem,26rem)]">
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
            Sub-modifiers that follow this one when a guest makes a selection.
          </p>
          <div className="space-y-2">
            {nestedModifiersList.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-3 p-2.5 bg-background rounded-lg border border-border group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {child.posDisplayName?.trim() && child.posDisplayName !== child.modifierName
                      ? child.posDisplayName
                      : child.modifierName}
                  </span>
                  {child.posDisplayName?.trim() && child.posDisplayName !== child.modifierName && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {child.modifierName}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>
                      {modifierModifierOptions.filter(mmo => mmo.modifierId === child.id).length} options
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setNestedModifierIds(nestedModifierIds.filter(id => id !== child.id))}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {nestedModifiersList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No nested modifiers added.
              </p>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-3 sm:p-4 border-t border-border bg-panel-bg flex gap-2 flex-shrink-0">
        <button
          onClick={handleCancel}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            isValid
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Save className="w-4 h-4" />
          Save & Add to Item
        </button>
      </div>

      {/* Save Confirmation Notification */}
      {showSaveNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-slide-up">
            <Check className="w-5 h-5" />
            <span className="font-medium">Modifier saved and added to item</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Export the handler for CreateOptionPanel
export { CreateModifierPanel as default };
