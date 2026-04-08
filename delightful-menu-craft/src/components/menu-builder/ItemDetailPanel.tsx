import { useState, useMemo, useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Trash2, Save, RotateCcw, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { Item } from '@/types/menu';
import {
  Select,
  SelectContent,
  SelectItem as SelectOption,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface ItemDetailPanelProps {
  item: Item;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface DraftState {
  itemName: string;
  posDisplayName: string;
  kdsName: string;
  itemPrice: number;
  itemDescription: string;
  stockStatus: string;
  orderQuantityLimit: boolean;
  minLimit: number;
  maxLimit: number;
  noMaxLimit: boolean;
  inheritModifiersFromCategory: boolean;
  preparationTime: number;
  calories: number;
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityOnline: boolean;
  visibilityThirdParty: boolean;
  availableDays: string;
  availableTimeStart: string;
  availableTimeEnd: string;
}

type DisplayNameMode = 'same_as_item' | 'custom_pos' | 'custom_kds' | 'custom_both';

function buildAvailabilitySummary(draft: DraftState): string {
  const channels = [
    draft.visibilityPos && 'POS',
    draft.visibilityKiosk && 'Kiosk',
    draft.visibilityOnline && 'Online',
    draft.visibilityThirdParty && '3PO',
  ].filter(Boolean) as string[];

  const activeDays = draft.availableDays
    ? draft.availableDays.split(',').map(d => d.trim()).filter(Boolean)
    : [];

  const parts: string[] = [];

  if (channels.length === 4) parts.push('All channels');
  else if (channels.length === 0) parts.push('Hidden');
  else parts.push(channels.join(', '));

  if (activeDays.length === 0 || activeDays.length === 7) parts.push('All days');
  else parts.push(activeDays.map(d => d.slice(0, 3)).join(', '));

  if (draft.availableTimeStart && draft.availableTimeEnd)
    parts.push(`${draft.availableTimeStart}–${draft.availableTimeEnd}`);
  else parts.push('All hours');

  return parts.join('  ·  ');
}

export function ItemDetailPanel({ item }: ItemDetailPanelProps) {
  const {
    updateItem,
    modifiers,
    modifierOptions,
    modifierModifierOptions,
    itemModifiers,
    addItemModifier,
    removeItemModifier,
    tags,
    allergens,
    setIsCreatingModifier,
    stations,
    addStation,
  } = useMenuStore();

  // Get nested child modifiers for a given modifier
  const getNestedModifiers = (modifierId: number) => {
    const mod = modifiers.find(m => m.id === modifierId);
    if (!mod) return [];
    // Primary: explicit modifierIds string
    if (mod.modifierIds) {
      const fromIds = mod.modifierIds
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id) && id > 0)
        .map(id => modifiers.find(m => m.id === id))
        .filter((m): m is NonNullable<typeof m> => m !== undefined);
      if (fromIds.length > 0) return fromIds;
    }
    // Fallback: find modifiers that declare this as their parent
    return modifiers.filter(m => m.parentModifierId === modifierId);
  };

  // Get options for a child modifier (join table first, parentModifierId fallback)
  const getChildModifierOptions = (modifierId: number) => {
    const joinEntries = modifierModifierOptions
      .filter(mmo => mmo.modifierId === modifierId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (joinEntries.length > 0) {
      return joinEntries.map(mmo => ({
        ...mmo,
        option: modifierOptions.find(o => o.id === mmo.modifierOptionId),
      }));
    }
    return modifierOptions
      .filter(o => o.parentModifierId === modifierId)
      .map((o, idx) => ({
        modifierId,
        modifierOptionId: o.id,
        isDefaultSelected: false,
        maxLimit: 0,
        optionDisplayName: o.optionName,
        sortOrder: idx,
        option: o,
      }));
  };
  
  // Draft state for all editable fields
  const [draft, setDraft] = useState<DraftState>({
    itemName: item.itemName,
    posDisplayName: item.posDisplayName,
    kdsName: item.kdsName ?? item.itemName,
    itemPrice: item.itemPrice,
    itemDescription: item.itemDescription,
    stockStatus: item.stockStatus,
    orderQuantityLimit: item.orderQuantityLimit ?? false,
    minLimit: item.minLimit ?? 0,
    maxLimit: item.maxLimit ?? 0,
    noMaxLimit: item.noMaxLimit ?? true,
    inheritModifiersFromCategory: item.inheritModifiersFromCategory,
    preparationTime: item.preparationTime,
    calories: item.calories,
    visibilityPos: item.visibilityPos ?? true,
    visibilityKiosk: item.visibilityKiosk ?? true,
    visibilityOnline: item.visibilityOnline ?? true,
    visibilityThirdParty: item.visibilityThirdParty ?? true,
    availableDays: item.availableDays ?? '',
    availableTimeStart: item.availableTimeStart ?? '',
    availableTimeEnd: item.availableTimeEnd ?? '',
  });

  const [displayNameMode, setDisplayNameMode] = useState<DisplayNameMode>('same_as_item');
  const [expandedNestedChildIds, setExpandedNestedChildIds] = useState<number[]>([]);
  
  const [priceInput, setPriceInput] = useState(item.itemPrice.toFixed(2));
  const [pendingModifierIds, setPendingModifierIds] = useState<number[]>([]);
  const [pendingRemovedModifierIds, setPendingRemovedModifierIds] = useState<number[]>([]);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [stationDraft, setStationDraft] = useState<string[]>(
    item.stationIds
      ? item.stationIds.split(',').map(id => id.trim()).filter(Boolean)
      : []
  );
  const [newStationName, setNewStationName] = useState('');

  // Reset draft state when item changes
  useEffect(() => {
    setDraft({
      itemName: item.itemName,
      posDisplayName: item.posDisplayName,
      kdsName: item.kdsName ?? item.itemName,
      itemPrice: item.itemPrice,
      itemDescription: item.itemDescription,
      stockStatus: item.stockStatus,
      orderQuantityLimit: item.orderQuantityLimit ?? false,
      minLimit: item.minLimit ?? 0,
      maxLimit: item.maxLimit ?? 0,
      noMaxLimit: item.noMaxLimit ?? true,
      inheritModifiersFromCategory: item.inheritModifiersFromCategory,
      preparationTime: item.preparationTime,
      calories: item.calories,
      visibilityPos: item.visibilityPos ?? true,
      visibilityKiosk: item.visibilityKiosk ?? true,
      visibilityOnline: item.visibilityOnline ?? true,
      visibilityThirdParty: item.visibilityThirdParty ?? true,
      availableDays: item.availableDays ?? '',
      availableTimeStart: item.availableTimeStart ?? '',
      availableTimeEnd: item.availableTimeEnd ?? '',
    });
    setPriceInput(item.itemPrice.toFixed(2));
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);
    setExpandedNestedChildIds([]);
    setStationDraft(
      item.stationIds
        ? item.stationIds.split(',').map(id => id.trim()).filter(Boolean)
        : []
    );
    setNewStationName('');
  }, [item.id]);

  useEffect(() => {
    const posMatches = draft.posDisplayName === draft.itemName;
    const kdsMatches = draft.kdsName === draft.itemName;
    if (posMatches && kdsMatches) setDisplayNameMode('same_as_item');
    else if (!posMatches && kdsMatches) setDisplayNameMode('custom_pos');
    else if (posMatches && !kdsMatches) setDisplayNameMode('custom_kds');
    else setDisplayNameMode('custom_both');
  }, [draft.itemName, draft.posDisplayName, draft.kdsName]);

  const originalStationIds = useMemo(
    () =>
      item.stationIds
        ? item.stationIds.split(',').map(id => id.trim()).filter(Boolean)
        : [],
    [item.stationIds]
  );

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    const originalStationsSorted = [...originalStationIds].sort();
    const draftStationsSorted = [...stationDraft].sort();
    const stationsChanged =
      originalStationsSorted.length !== draftStationsSorted.length ||
      originalStationsSorted.some((id, idx) => id !== draftStationsSorted[idx]);

    return (
      draft.itemName !== item.itemName ||
      draft.posDisplayName !== item.posDisplayName ||
      draft.kdsName !== (item.kdsName ?? item.itemName) ||
      draft.itemPrice !== item.itemPrice ||
      draft.itemDescription !== item.itemDescription ||
      draft.stockStatus !== item.stockStatus ||
      draft.orderQuantityLimit !== (item.orderQuantityLimit ?? false) ||
      draft.minLimit !== (item.minLimit ?? 0) ||
      draft.maxLimit !== (item.maxLimit ?? 0) ||
      draft.noMaxLimit !== (item.noMaxLimit ?? true) ||
      draft.inheritModifiersFromCategory !== item.inheritModifiersFromCategory ||
      draft.preparationTime !== item.preparationTime ||
      draft.calories !== item.calories ||
      draft.visibilityPos !== (item.visibilityPos ?? true) ||
      draft.visibilityKiosk !== (item.visibilityKiosk ?? true) ||
      draft.visibilityOnline !== (item.visibilityOnline ?? true) ||
      draft.visibilityThirdParty !== (item.visibilityThirdParty ?? true) ||
      draft.availableDays !== (item.availableDays ?? '') ||
      draft.availableTimeStart !== (item.availableTimeStart ?? '') ||
      draft.availableTimeEnd !== (item.availableTimeEnd ?? '') ||
      pendingModifierIds.length > 0 ||
      pendingRemovedModifierIds.length > 0 ||
      stationsChanged
    );
  }, [draft, item, pendingModifierIds, pendingRemovedModifierIds, originalStationIds, stationDraft]);

  const handleSave = () => {
    // Save item changes
    updateItem(item.id, {
      itemName: draft.itemName,
      posDisplayName: draft.posDisplayName,
      kdsName: draft.kdsName,
      itemPrice: draft.itemPrice,
      itemDescription: draft.itemDescription,
      stockStatus: draft.stockStatus,
      orderQuantityLimit: draft.orderQuantityLimit,
      minLimit: draft.minLimit,
      maxLimit: draft.maxLimit,
      noMaxLimit: draft.noMaxLimit,
      inheritModifiersFromCategory: draft.inheritModifiersFromCategory,
      preparationTime: draft.preparationTime,
      calories: draft.calories,
      stationIds: stationDraft.join(','),
      visibilityPos: draft.visibilityPos,
      visibilityKiosk: draft.visibilityKiosk,
      visibilityOnline: draft.visibilityOnline,
      visibilityThirdParty: draft.visibilityThirdParty,
      availableDays: draft.availableDays,
      availableTimeStart: draft.availableTimeStart,
      availableTimeEnd: draft.availableTimeEnd,
    });

    // Ensure any new stations are registered in the store
    stationDraft.forEach(id => {
      if (id.trim()) {
        addStation(id);
      }
    });

    // Save pending modifier additions
    pendingModifierIds.forEach((modifierId) => {
      addItemModifier({
        modifierId: modifierId,
        itemId: item.id,
        sortOrder: attachedModifierIds.length + pendingModifierIds.indexOf(modifierId),
      });
    });

    // Save pending modifier removals
    pendingRemovedModifierIds.forEach((modifierId) => {
      removeItemModifier(modifierId, item.id);
    });

    // Clear pending changes
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);

    // Show save notification
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  const handleDiscard = () => {
    setDraft({
      itemName: item.itemName,
      posDisplayName: item.posDisplayName,
      kdsName: item.kdsName ?? item.itemName,
      itemPrice: item.itemPrice,
      itemDescription: item.itemDescription,
      stockStatus: item.stockStatus,
      orderQuantityLimit: item.orderQuantityLimit ?? false,
      minLimit: item.minLimit ?? 0,
      maxLimit: item.maxLimit ?? 0,
      noMaxLimit: item.noMaxLimit ?? true,
      inheritModifiersFromCategory: item.inheritModifiersFromCategory,
      preparationTime: item.preparationTime,
      calories: item.calories,
      visibilityPos: item.visibilityPos ?? true,
      visibilityKiosk: item.visibilityKiosk ?? true,
      visibilityOnline: item.visibilityOnline ?? true,
      visibilityThirdParty: item.visibilityThirdParty ?? true,
      availableDays: item.availableDays ?? '',
      availableTimeStart: item.availableTimeStart ?? '',
      availableTimeEnd: item.availableTimeEnd ?? '',
    });
    setPriceInput(item.itemPrice.toFixed(2));
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);
    setStationDraft(originalStationIds);
    setNewStationName('');
  };

  const handlePriceChange = (value: string) => {
    setPriceInput(value);
    const price = parseFloat(value);
    if (!isNaN(price) && price >= 0) {
      setDraft(d => ({ ...d, itemPrice: price }));
    }
  };

  // Get modifiers attached to this item via itemModifiers join table
  const attachedModifierIds = useMemo(() => {
    return itemModifiers
      .filter(im => im.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(im => im.modifierId)
      .filter(id => !pendingRemovedModifierIds.includes(id));
  }, [itemModifiers, item.id, pendingRemovedModifierIds]);

  // Combine saved and pending modifiers
  const allAttachedModifierIds = useMemo(() => {
    return [...attachedModifierIds, ...pendingModifierIds];
  }, [attachedModifierIds, pendingModifierIds]);

  const attachedModifiers = useMemo(() => {
    return allAttachedModifierIds
      .map(id => modifiers.find(m => m.id === id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);
  }, [allAttachedModifierIds, modifiers]);

  // Get available modifiers (not yet attached, including pending)
  const availableModifiers = useMemo(() => {
    return modifiers.filter(m => !allAttachedModifierIds.includes(m.id));
  }, [modifiers, allAttachedModifierIds]);

  // Get options for a modifier
  const getModifierOptions = (modifierId: number) => {
    const optionAssignments = modifierModifierOptions
      .filter(mmo => mmo.modifierId === modifierId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    
    return optionAssignments.map(mmo => {
      const option = modifierOptions.find(o => o.id === mmo.modifierOptionId);
      return {
        ...mmo,
        option,
      };
    });
  };

  const handleAddModifier = (modifierId: string) => {
    const id = parseInt(modifierId);
    if (isNaN(id)) return;
    
    // Add to pending list instead of immediately saving
    if (!pendingModifierIds.includes(id) && !attachedModifierIds.includes(id)) {
      setPendingModifierIds([...pendingModifierIds, id]);
    }
  };

  const handleRemoveModifier = (modifierId: number) => {
    // If it's a pending addition, just remove from pending
    if (pendingModifierIds.includes(modifierId)) {
      setPendingModifierIds(pendingModifierIds.filter(id => id !== modifierId));
    } else {
      // If it's already saved, add to pending removals
      setPendingRemovedModifierIds([...pendingRemovedModifierIds, modifierId]);
    }
  };

  // Parse tag IDs
  const itemTagIds = item.tagIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
  const itemTags = tags.filter(t => itemTagIds.includes(t.id));

  // Parse allergen IDs
  const itemAllergenIds = item.allergenIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || [];
  const itemAllergens = allergens.filter(a => itemAllergenIds.includes(a.id));

  const handleToggleStation = (stationId: string) => {
    setStationDraft(prev => {
      if (prev.includes(stationId)) {
        return prev.filter(id => id !== stationId);
      }
      return [...prev, stationId];
    });
  };

  const handleAddStationInline = () => {
    const trimmed = newStationName.trim();
    if (!trimmed) return;
    addStation(trimmed);
    setStationDraft(prev =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    );
    setNewStationName('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-600 text-xs font-medium">
          You have unsaved changes
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {/* Item Name */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="section-header">Item Name</Label>
            <Select
              value={displayNameMode}
              onValueChange={(value: DisplayNameMode) => {
                setDisplayNameMode(value);
                setDraft(d => {
                  if (value === 'same_as_item') {
                    return { ...d, posDisplayName: d.itemName, kdsName: d.itemName };
                  }
                  if (value === 'custom_pos') {
                    return { ...d, kdsName: d.itemName };
                  }
                  if (value === 'custom_kds') {
                    return { ...d, posDisplayName: d.itemName };
                  }
                  return d;
                });
              }}
            >
              <SelectTrigger className="h-7 w-[128px] px-2 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectOption value="same_as_item">Match item</SelectOption>
                <SelectOption value="custom_pos">Custom POS</SelectOption>
                <SelectOption value="custom_kds">Custom KDS</SelectOption>
                <SelectOption value="custom_both">Custom both</SelectOption>
              </SelectContent>
            </Select>
          </div>
          <input
            type="text"
            value={draft.itemName}
            onChange={(e) => setDraft(d => ({ 
              ...d, 
              itemName: e.target.value,
              posDisplayName:
                displayNameMode === 'custom_pos' || displayNameMode === 'custom_both'
                  ? d.posDisplayName
                  : e.target.value,
              kdsName:
                displayNameMode === 'custom_kds' || displayNameMode === 'custom_both'
                  ? d.kdsName
                  : e.target.value,
            }))}
            className="input-field text-lg font-semibold w-full"
            placeholder="Item name"
          />
          {(displayNameMode === 'custom_pos' || displayNameMode === 'custom_both') && (
            <input
              type="text"
              value={draft.posDisplayName}
              onChange={(e) => setDraft(d => ({ ...d, posDisplayName: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="POS display name"
            />
          )}
          {(displayNameMode === 'custom_kds' || displayNameMode === 'custom_both') && (
            <input
              type="text"
              value={draft.kdsName}
              onChange={(e) => setDraft(d => ({ ...d, kdsName: e.target.value }))}
              className="input-field w-full text-sm"
              placeholder="KDS display name"
            />
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="section-header">Description</Label>
          <textarea
            value={draft.itemDescription}
            onChange={(e) => setDraft(d => ({ ...d, itemDescription: e.target.value }))}
            className="input-field w-full min-h-[80px] resize-none"
            placeholder="Item description (optional)"
          />
        </div>

        {/* Base Price */}
        <div className="space-y-2">
          <Label className="section-header">Price</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <input
              type="text"
              value={priceInput}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="input-field w-24"
            />
          </div>
        </div>

        {/* Stock Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="stockStatus" className="text-sm">In Stock</Label>
            <Switch
              id="stockStatus"
              checked={draft.stockStatus === 'inStock'}
              onCheckedChange={(checked) => setDraft(d => ({ 
                ...d, 
                stockStatus: checked ? 'inStock' : 'outOfStock' 
              }))}
            />
          </div>
        </div>

        {/* Technical sections — collapsed by default */}
        <Accordion
          type="multiple"
          defaultValue={[]}
          className="rounded-lg border border-border bg-muted/10 overflow-hidden"
        >
          <AccordionItem value="order-quantity" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order quantity
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="orderQuantityLimit" className="text-sm">Limit quantity per order</Label>
                    <p className="text-xs text-muted-foreground">Set min/max how many of this item can be ordered at once</p>
                  </div>
                  <Switch
                    id="orderQuantityLimit"
                    checked={draft.orderQuantityLimit}
                    onCheckedChange={(checked) => setDraft(d => ({ ...d, orderQuantityLimit: checked }))}
                  />
                </div>
                {draft.orderQuantityLimit && (
                  <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Minimum</Label>
                        <input
                          type="number"
                          min={0}
                          value={draft.minLimit}
                          onChange={(e) =>
                            setDraft(d => ({
                              ...d,
                              minLimit: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="input-field w-full"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Maximum</Label>
                        <input
                          type="number"
                          min={1}
                          value={draft.maxLimit}
                          disabled={draft.noMaxLimit}
                          onChange={(e) =>
                            setDraft(d => ({
                              ...d,
                              maxLimit: Math.max(1, parseInt(e.target.value, 10) || 1),
                            }))
                          }
                          className="input-field w-full disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label htmlFor="noMaxLimit" className="text-sm">No maximum</Label>
                        <p className="text-xs text-muted-foreground">Allow unlimited quantity on a single order</p>
                      </div>
                      <Switch
                        id="noMaxLimit"
                        checked={draft.noMaxLimit}
                        onCheckedChange={(checked) => setDraft(d => ({ ...d, noMaxLimit: checked }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="availability" className="border-b border-border px-3">
            <AccordionTrigger className="px-0 py-3 hover:no-underline items-start gap-2 [&>svg]:mt-1">
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Availability</div>
                <div className="text-[10px] font-normal normal-case text-muted-foreground truncate mt-0.5 pr-2">
                  {buildAvailabilitySummary(draft)}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channels</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'visibilityPos', label: 'POS' },
                      { key: 'visibilityKiosk', label: 'Kiosk' },
                      { key: 'visibilityOnline', label: 'Online' },
                      { key: 'visibilityThirdParty', label: '3rd Party' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDraft(d => ({ ...d, [key]: !d[key] }))}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-md border text-sm font-medium transition-colors",
                          draft[key]
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-muted/50 border-border text-muted-foreground line-through"
                        )}
                      >
                        <span>{label}</span>
                        <span className="text-xs">{draft[key] ? '✓' : '✕'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Days</p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        const activeDays = draft.availableDays
                          ? draft.availableDays.split(',').map(d => d.trim()).filter(Boolean)
                          : [];
                        setDraft(d => ({ ...d, availableDays: activeDays.length === 7 || activeDays.length === 0 ? '' : DAYS.join(',') }));
                      }}
                    >
                      {(draft.availableDays === '' || draft.availableDays.split(',').filter(Boolean).length === 7)
                        ? 'All days'
                        : 'Select all'}
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {DAYS.map(day => {
                      const activeDays = draft.availableDays
                        ? draft.availableDays.split(',').map(d => d.trim()).filter(Boolean)
                        : [];
                      const allActive = activeDays.length === 0;
                      const isActive = allActive || activeDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const current = draft.availableDays
                              ? draft.availableDays.split(',').map(d => d.trim()).filter(Boolean)
                              : DAYS.slice();
                            const base = draft.availableDays === '' ? [...DAYS] : current;
                            const next = base.includes(day)
                              ? base.filter(d => d !== day)
                              : [...base, day];
                            setDraft(d => ({ ...d, availableDays: next.length === 7 ? '' : next.join(',') }));
                          }}
                          className={cn(
                            "flex-1 py-1.5 rounded text-xs font-medium transition-colors border",
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border"
                          )}
                        >
                          {day.slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {draft.availableDays === '' || draft.availableDays.split(',').filter(Boolean).length === 7
                      ? 'Available every day'
                      : `Available: ${draft.availableDays.split(',').filter(Boolean).join(', ')}`
                    }
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hours</p>
                    {(draft.availableTimeStart || draft.availableTimeEnd) && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setDraft(d => ({ ...d, availableTimeStart: '', availableTimeEnd: '' }))}
                      >
                        Clear (all hours)
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
                      <input
                        type="time"
                        value={draft.availableTimeStart}
                        onChange={e => setDraft(d => ({ ...d, availableTimeStart: e.target.value }))}
                        className="input-field flex-1 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
                      <input
                        type="time"
                        value={draft.availableTimeEnd}
                        onChange={e => setDraft(d => ({ ...d, availableTimeEnd: e.target.value }))}
                        className="input-field flex-1 text-sm"
                      />
                    </div>
                  </div>
                  {!draft.availableTimeStart && !draft.availableTimeEnd && (
                    <p className="text-xs text-muted-foreground">Available all hours</p>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-modifiers" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                Modifiers
                {attachedModifiers.length > 0 && (
                  <span className="text-[10px] font-normal normal-case tabular-nums text-muted-foreground/80">
                    ({attachedModifiers.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2">
                  {availableModifiers.length > 0 && (
                    <Select onValueChange={handleAddModifier}>
                      <SelectTrigger className="w-32">
                        <span className="text-xs flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          Add
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {availableModifiers.map((mod) => (
                          <SelectOption key={mod.id} value={mod.id.toString()}>
                            {mod.modifierName}
                          </SelectOption>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <button
                    className="btn-add"
                    onClick={() => setIsCreatingModifier(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </button>
                </div>

                {attachedModifiers.length > 0 ? (
                  <Accordion type="multiple" className="space-y-1">
              {attachedModifiers.map((modifier) => {
                const options = getModifierOptions(modifier.id);
                const isPending = pendingModifierIds.includes(modifier.id);
                const isPendingRemoval = pendingRemovedModifierIds.includes(modifier.id);
                return (
                  <AccordionItem 
                    key={modifier.id} 
                    value={modifier.id.toString()} 
                    className={cn(
                      "border rounded-md",
                      isPending && "border-green-500/50 bg-green-500/5",
                      isPendingRemoval && "opacity-50"
                    )}
                  >
                    <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-2">
                        <div className="flex items-center gap-2">
                          <span>{modifier.modifierName}</span>
                          {isPending && (
                            <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
                              New
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveModifier(modifier.id);
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
                          <span>{modifier.isOptional || 'Required'} • Min: {modifier.minSelector} / Max: {modifier.noMaxSelection ? '∞' : modifier.maxSelector}</span>
                          {modifier.pizzaSelection && (
                            <span className="bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded font-medium">Pizza</span>
                          )}
                          {modifier.isSizeModifier && (
                            <span className="bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded font-medium">Size</span>
                          )}
                        </div>
                        {options.map((opt) => (
                          <div key={opt.modifierOptionId} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span>{opt.option?.optionName || opt.optionDisplayName}</span>
                              {opt.isDefaultSelected && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground">
                              {opt.maxLimit > 0 ? `+$${opt.maxLimit.toFixed(2)}` : '$0.00'}
                            </span>
                          </div>
                        ))}
                        {/* Nested modifiers */}
                        {(() => {
                          const nested = getNestedModifiers(modifier.id);
                          if (nested.length === 0) return null;
                          return (
                            <div className="mt-3 pt-2 border-t border-border/50 space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                Nested modifiers:
                              </p>
                              {nested.map(child => {
                                const childOpts = getChildModifierOptions(child.id);
                                const isExpanded = expandedNestedChildIds.includes(child.id);
                                return (
                                  <div key={child.id} className="rounded border border-border/60 overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedNestedChildIds(prev =>
                                          prev.includes(child.id)
                                            ? prev.filter(id => id !== child.id)
                                            : [...prev, child.id]
                                        )
                                      }
                                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                                      )}
                                      <span className="font-medium text-foreground flex-1 text-left">
                                        {child.posDisplayName || child.modifierName}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {childOpts.length} options
                                      </span>
                                    </button>
                                    {isExpanded && (
                                      <div className="border-t border-border/50 bg-muted/25 px-3 py-2 pl-6 space-y-1">
                                        {childOpts.length === 0 ? (
                                          <p className="text-xs text-muted-foreground py-0.5">No options defined</p>
                                        ) : (
                                          childOpts.map(opt => (
                                            <div
                                              key={opt.modifierOptionId}
                                              className="flex items-center justify-between text-xs py-0.5 border-b border-border/40 last:border-0"
                                            >
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-foreground">
                                                  {opt.option?.posDisplayName || opt.option?.optionName || opt.optionDisplayName}
                                                </span>
                                                {opt.isDefaultSelected && (
                                                  <span className="text-[10px] bg-primary/10 text-primary px-1 rounded">
                                                    Default
                                                  </span>
                                                )}
                                              </div>
                                              <span className="text-muted-foreground tabular-nums">
                                                {opt.maxLimit > 0 ? `+$${opt.maxLimit.toFixed(2)}` : '$0.00'}
                                              </span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground">No modifiers attached</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tags" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                Tags
                <span className="text-[10px] font-normal normal-case tabular-nums text-muted-foreground/80">
                  ({itemTags.length})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {itemTags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {itemTags.map(tag => (
                    <span
                      key={tag.id}
                      className="text-xs bg-muted px-2 py-1 rounded"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tags on this item</p>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="stations" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                Stations
                {stationDraft.length > 0 && (
                  <span className="text-[10px] font-normal normal-case tabular-nums text-muted-foreground/80">
                    ({stationDraft.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Assign this item to one or more kitchen stations.
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {stationDraft.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      No stations assigned
                    </span>
                  )}
                  {stationDraft.map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleToggleStation(id)}
                      className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center gap-1"
                    >
                      <span>{id}</span>
                      <span className="text-[10px] leading-none">✕</span>
                    </button>
                  ))}
                </div>
                {stations.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {stations.map(id => (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <Checkbox
                          checked={stationDraft.includes(id)}
                          onCheckedChange={() => handleToggleStation(id)}
                        />
                        <span className="text-muted-foreground">{id}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    placeholder="Add station ID..."
                    className="input-field flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddStationInline}
                    className="btn-add px-2 py-1 text-xs"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="allergens" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                Allergens
                <span className="text-[10px] font-normal normal-case tabular-nums text-muted-foreground/80">
                  ({itemAllergens.length})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {itemAllergens.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {itemAllergens.map(allergen => (
                    <span
                      key={allergen.id}
                      className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded"
                    >
                      {allergen.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No allergens on this item</p>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="kitchen-details" className="border-b-0 px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kitchen & details
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="inheritMods" className="text-sm text-muted-foreground">Inherit modifiers from category</Label>
                  <Switch
                    id="inheritMods"
                    checked={draft.inheritModifiersFromCategory}
                    onCheckedChange={(checked) => setDraft(d => ({ ...d, inheritModifiersFromCategory: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prep time (min)</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.preparationTime}
                    onChange={(e) => setDraft(d => ({ ...d, preparationTime: parseInt(e.target.value) || 0 }))}
                    className="input-field w-20 text-right"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Calories</span>
                  <input
                    type="number"
                    min={0}
                    value={draft.calories}
                    onChange={(e) => setDraft(d => ({ ...d, calories: parseInt(e.target.value) || 0 }))}
                    className="input-field w-20 text-right"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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

      {/* Save Confirmation Notification */}
      {showSaveNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg shadow-lg animate-slide-up">
            <Check className="w-5 h-5" />
            <span className="font-medium">Changes saved successfully</span>
          </div>
        </div>
      )}
    </div>
  );
}
