import { useState, useMemo, useEffect, useRef } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Trash2, Save, RotateCcw, Check, ChevronDown, ChevronRight, X, GripVertical, Layers, Pencil, ArrowDownUp, Link, Unlink, ImageIcon, Upload, AlertTriangle } from 'lucide-react';
import { CategoryImageLibraryModal } from '@/components/categories/CategoryImageLibraryModal';
import { LoadingImage } from '@/components/ui/loading-image';
import { TagIconPicker } from '@/components/tags/TagIconPicker';
import { resolveTagIcon } from '@/lib/tagIcons';
import { SaleCategorySelect } from '@/components/menu-builder/SaleCategorySelect';
import { ModTypeBadge } from '@/components/menu-builder/pos-preview/ModifierPanel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Item } from '@/types/menu';
import {
  VISIBILITY_CHANNELS,
  defaultVisibility,
  getChannelsByGroup,
  parseGroupSchedules,
  serializeGroupSchedules,
  buildGroupSchedulesSummary,
  defaultGroupSchedules,
  toggleVisibilityChannel,
  DAYS as SCHEDULE_DAYS,
  type ChannelGroupSchedules,
  type DayKey,
  type VisibilityGroup,
} from '@/lib/visibility';
import {
  Select,
  SelectContent,
  SelectItem as SelectOption,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { NumberStepperInput } from '@/components/ui/number-stepper-input';
import { effectiveItemTaxRate } from '@/lib/tax';
import { cn } from '@/lib/utils';

interface ItemDetailPanelProps {
  item: Item;
}

function parseIds(csv: string | undefined): number[] {
  if (!csv?.trim()) return [];
  return csv.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
}

function serializeIds(ids: number[]): string {
  return [...new Set(ids)].sort((a, b) => a - b).join(',');
}

interface DraftState {
  itemName: string;
  posDisplayName: string;
  kdsName: string;
  itemPrice: number;
  doordashPrice: number;
  uberEatsPrice: number;
  grubHubPrice: number;
  itemDescription: string;
  itemPicture: string;
  kioskItemImage: string;
  onlineImage: string;
  thirdPartyImage: string;
  landscapeImage: string;
  salesTax: boolean;
  customTaxId?: number;
  takeoutException: boolean;
  taxLinkedWithParentSetting: boolean;
  stockStatus: string;
  orderQuantityLimit: boolean;
  minLimit: number;
  maxLimit: number;
  noMaxLimit: boolean;
  inheritModifiersFromCategory: boolean;
  inheritVisibilityFromCategory: boolean;
  preparationTime: number;
  calories: number;
  saleCategory: string;
  visibilityPos: boolean;
  visibilityKiosk: boolean;
  visibilityMenuBoard: boolean;
  visibilityNugget: boolean;
  visibilityQr: boolean;
  visibilityWebsite: boolean;
  visibilityOnline: boolean;
  visibilityMobileApp: boolean;
  visibilityDoordash: boolean;
  daySchedulesByGroup: ChannelGroupSchedules;
}

type ItemImageField = 'itemPicture' | 'kioskItemImage' | 'onlineImage' | 'thirdPartyImage';
type ItemUploadField = ItemImageField | 'landscapeImage';

const ITEM_IMAGE_FIELDS: { field: ItemImageField; label: string }[] = [
  { field: 'itemPicture', label: 'POS & mPOS' },
  { field: 'onlineImage', label: 'Online & QR' },
  { field: 'kioskItemImage', label: 'KIOSK' },
  { field: 'thirdPartyImage', label: '3rd Party Delivery' },
];

function namesInitiallyLinked(item: Item): boolean {
  const kds = item.kdsName ?? item.itemName;
  return item.posDisplayName === item.itemName && kds === item.itemName;
}

function buildAvailabilitySummary(draft: DraftState): string {
  const channels = VISIBILITY_CHANNELS
    .filter(({ key }) => draft[key])
    .map(({ label }) => label);

  const parts: string[] = [];

  if (channels.length === VISIBILITY_CHANNELS.length) parts.push('All channels');
  else if (channels.length === 0) parts.push('Hidden');
  else parts.push(channels.join(', '));

  parts.push(buildGroupSchedulesSummary(draft.daySchedulesByGroup));

  return parts.join('  ·  ');
}

function getItemNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'Item name cannot contain spaces only';
  if (trimmed.length === 0) return 'Item name required';
  if (/^\d$/.test(trimmed)) return null;
  if (trimmed.length < 2 || trimmed.length > 60) return 'Item name must be between 2-60 characters';
  return null;
}

function getItemPosNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'POS name cannot contain spaces only';
  if (trimmed.length === 0) return 'POS name required';
  if (trimmed.length < 2 || trimmed.length > 60) return 'POS name must be between 2-60 characters';
  return null;
}

function getItemKdsNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'KDS name cannot contain spaces only';
  if (trimmed.length === 0) return 'KDS name required';
  if (trimmed.length < 2 || trimmed.length > 40) return 'KDS name must be between 2-40 characters';
  return null;
}

export function ItemDetailPanel({ item }: ItemDetailPanelProps) {
  const {
    updateItem,
    items,
    modifiers,
    updateModifier,
    modifierGroups,
    modifierOptions,
    modifierModifierOptions,
    itemModifiers,
    categoryModifiers,
    categoryItems,
    categories,
    addItemModifier,
    removeItemModifier,
    tags,
    allergens,
    addTag,
    updateTag,
    deleteTag,
    addAllergen,
    deleteAllergen,
    getNextId,
    setIsCreatingModifier,
    navigateToModifier,
    stations,
    reorderModifierOptions,
    setModifierOptionOrder,
    setItemModifierOrder,
    taxRate,
    customTaxes,
    setActiveTab,
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
    doordashPrice: item.doordashPrice ?? 0,
    uberEatsPrice: item.uberEatsPrice ?? 0,
    grubHubPrice: item.grubHubPrice ?? 0,
    itemDescription: item.itemDescription,
    itemPicture: item.itemPicture || '',
    kioskItemImage: item.kioskItemImage || '',
    onlineImage: item.onlineImage || '',
    thirdPartyImage: item.thirdPartyImage || '',
    landscapeImage: item.landscapeImage || '',
    salesTax: item.salesTax ?? true,
    customTaxId: item.customTaxId,
    takeoutException: item.takeoutException ?? false,
    taxLinkedWithParentSetting: item.taxLinkedWithParentSetting ?? true,
    stockStatus: item.stockStatus,
    orderQuantityLimit: item.orderQuantityLimit ?? true,
    minLimit: item.minLimit || 1,
    maxLimit: item.maxLimit || 1,
    noMaxLimit: item.noMaxLimit ?? true,
    inheritModifiersFromCategory: item.inheritModifiersFromCategory,
    preparationTime: item.preparationTime,
    calories: item.calories,
    saleCategory: item.saleCategory ?? '',
    ...defaultVisibility(),
    visibilityPos: item.visibilityPos ?? true,
    visibilityKiosk: item.visibilityKiosk ?? true,
    visibilityMenuBoard: item.visibilityMenuBoard ?? true,
    visibilityNugget: item.visibilityNugget ?? true,
    visibilityQr: item.visibilityQr ?? true,
    visibilityWebsite: item.visibilityWebsite ?? true,
    visibilityOnline: item.visibilityOnline ?? true,
    visibilityMobileApp: item.visibilityMobileApp ?? true,
    visibilityDoordash: item.visibilityDoordash ?? true,
    daySchedulesByGroup: parseGroupSchedules(item.daySchedulesByGroup, item.daySchedules),
  });

  /** While true, editing item name updates POS + KDS to match. False after POS or KDS is edited, or on load if names already differ. */
  const [itemNameDrivesPosKds, setItemNameDrivesPosKds] = useState(() => namesInitiallyLinked(item));
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const [openChannelGroup, setOpenChannelGroup] = useState<string | null>(null);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
  const [expandedNestedChildIds, setExpandedNestedChildIds] = useState<number[]>([]);
  
  const [priceInput, setPriceInput] = useState(item.itemPrice.toFixed(2));
  // 3PO delivery price inputs — empty string means "unset" (0).
  const fmt3po = (v: number | undefined) => (v ? v.toFixed(2) : '');
  const [doordashInput, setDoordashInput] = useState(fmt3po(item.doordashPrice));
  const [uberEatsInput, setUberEatsInput] = useState(fmt3po(item.uberEatsPrice));
  const [grubHubInput, setGrubHubInput] = useState(fmt3po(item.grubHubPrice));
  const [pendingModifierIds, setPendingModifierIds] = useState<number[]>([]);
  const [pendingRemovedModifierIds, setPendingRemovedModifierIds] = useState<number[]>([]);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [stationDraft, setStationDraft] = useState<number[]>(
    item.stationIds
      ? item.stationIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
      : []
  );
  const [addonDraft, setAddonDraft] = useState<number[]>(parseIds(item.addonIds));
  const [addonSearch, setAddonSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<number | null>(null);
  const [newAllergenName, setNewAllergenName] = useState('');
  const [showAllergenInput, setShowAllergenInput] = useState(false);
  const [pendingDeleteAllergenId, setPendingDeleteAllergenId] = useState<number | null>(null);
  const [newStationName, setNewStationName] = useState('');
  const [optionDragState, setOptionDragState] = useState<{ modifierId: number; index: number } | null>(null);
  const [optionDragOverState, setOptionDragOverState] = useState<{ modifierId: number; index: number } | null>(null);
  const [modDragId, setModDragId] = useState<number | null>(null);
  const [modDragOverId, setModDragOverId] = useState<number | null>(null);
  // Unified display order for attached modifiers (saved + pending), so a
  // newly-attached modifier can be dragged/sorted in with the saved ones.
  const [modifierOrder, setModifierOrder] = useState<number[]>([]);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupPickerSearch, setGroupPickerSearch] = useState('');
  const groupPickerRef = useRef<HTMLDivElement>(null);
  const [modPickerOpen, setModPickerOpen] = useState(false);
  const [modPickerSearch, setModPickerSearch] = useState('');
  const modPickerRef = useRef<HTMLDivElement>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  // Which modifier's "sort options" dropdown is currently open (null = none)
  const [optionSortMenuModifierId, setOptionSortMenuModifierId] = useState<number | null>(null);
  const optionSortMenuRef = useRef<HTMLDivElement>(null);
  // Which parent modifier's "sort nested modifiers" dropdown is currently open (null = none)
  const [nestedModSortMenuParentId, setNestedModSortMenuParentId] = useState<number | null>(null);
  const nestedModSortMenuRef = useRef<HTMLDivElement>(null);
  // Which nested child modifier's "sort options" dropdown is currently open (null = none)
  const [nestedOptionSortMenuChildId, setNestedOptionSortMenuChildId] = useState<number | null>(null);
  const nestedOptionSortMenuRef = useRef<HTMLDivElement>(null);
  const [namesExpanded, setNamesExpanded] = useState(false);
  const [imageModalTarget, setImageModalTarget] = useState<ItemUploadField | null>(null);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [touched, setTouched] = useState({ itemName: false, posDisplayName: false, kdsName: false });

  // Reset draft state when item changes
  useEffect(() => {
    setDraft({
      itemName: item.itemName,
      posDisplayName: item.posDisplayName,
      kdsName: item.kdsName ?? item.itemName,
      itemPrice: item.itemPrice,
      doordashPrice: item.doordashPrice ?? 0,
      uberEatsPrice: item.uberEatsPrice ?? 0,
      grubHubPrice: item.grubHubPrice ?? 0,
      itemDescription: item.itemDescription,
      itemPicture: item.itemPicture || '',
      kioskItemImage: item.kioskItemImage || '',
      onlineImage: item.onlineImage || '',
      thirdPartyImage: item.thirdPartyImage || '',
      landscapeImage: item.landscapeImage || '',
      salesTax: item.salesTax ?? true,
      customTaxId: item.customTaxId,
      takeoutException: item.takeoutException ?? false,
      taxLinkedWithParentSetting: item.taxLinkedWithParentSetting ?? true,
      stockStatus: item.stockStatus,
      orderQuantityLimit: item.orderQuantityLimit ?? true,
      minLimit: item.minLimit || 1,
      maxLimit: item.maxLimit || 1,
      noMaxLimit: item.noMaxLimit ?? true,
      inheritModifiersFromCategory: item.inheritModifiersFromCategory,
      inheritVisibilityFromCategory: item.inheritVisibilityFromCategory === true,
      preparationTime: item.preparationTime,
      calories: item.calories,
      saleCategory: item.saleCategory ?? '',
      ...defaultVisibility(),
      visibilityPos: item.visibilityPos ?? true,
      visibilityKiosk: item.visibilityKiosk ?? true,
      visibilityMenuBoard: item.visibilityMenuBoard ?? true,
      visibilityNugget: item.visibilityNugget ?? true,
      visibilityQr: item.visibilityQr ?? true,
      visibilityWebsite: item.visibilityWebsite ?? true,
      visibilityOnline: item.visibilityOnline ?? true,
      visibilityMobileApp: item.visibilityMobileApp ?? true,
      visibilityDoordash: item.visibilityDoordash ?? true,
      daySchedulesByGroup: parseGroupSchedules(item.daySchedulesByGroup, item.daySchedules),
    });
    setExpandedDay(null);
    setBulkStart('');
    setBulkEnd('');
    setPriceInput(item.itemPrice.toFixed(2));
    setDoordashInput(fmt3po(item.doordashPrice));
    setUberEatsInput(fmt3po(item.uberEatsPrice));
    setGrubHubInput(fmt3po(item.grubHubPrice));
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);
    setModifierOrder(
      itemModifiers
        .filter((im) => im.itemId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((im) => im.modifierId)
    );
    setExpandedNestedChildIds([]);
    setStationDraft(
      item.stationIds
        ? item.stationIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
        : []
    );
    setAddonDraft(parseIds(item.addonIds));
    setAddonSearch('');
    setNewStationName('');
    setNamesExpanded(false);
    setImageModalTarget(null);
    setImagesOpen(false);
    setTouched({ itemName: false, posDisplayName: false, kdsName: false });
  }, [item.id]);

  // Keep "item name drives POS/KDS" in sync with saved data after save; reset when switching items
  useEffect(() => {
    setItemNameDrivesPosKds(namesInitiallyLinked(item));
  }, [item.id, item.itemName, item.posDisplayName, item.kdsName]);

  useEffect(() => {
    if (!groupPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (groupPickerRef.current && !groupPickerRef.current.contains(e.target as Node)) {
        setGroupPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [groupPickerOpen]);

  useEffect(() => {
    if (!modPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (modPickerRef.current && !modPickerRef.current.contains(e.target as Node)) {
        setModPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modPickerOpen]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortMenuOpen]);

  useEffect(() => {
    if (optionSortMenuModifierId === null) return;
    const handler = (e: MouseEvent) => {
      if (optionSortMenuRef.current && !optionSortMenuRef.current.contains(e.target as Node)) {
        setOptionSortMenuModifierId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [optionSortMenuModifierId]);

  useEffect(() => {
    if (nestedModSortMenuParentId === null) return;
    const handler = (e: MouseEvent) => {
      if (nestedModSortMenuRef.current && !nestedModSortMenuRef.current.contains(e.target as Node)) {
        setNestedModSortMenuParentId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [nestedModSortMenuParentId]);

  useEffect(() => {
    if (nestedOptionSortMenuChildId === null) return;
    const handler = (e: MouseEvent) => {
      if (nestedOptionSortMenuRef.current && !nestedOptionSortMenuRef.current.contains(e.target as Node)) {
        setNestedOptionSortMenuChildId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [nestedOptionSortMenuChildId]);

  const originalStationIds = useMemo(
    () =>
      item.stationIds
        ? item.stationIds.split(',').map((id) => parseInt(id.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
        : [],
    [item.stationIds],
  );

  const originalAddonIds = useMemo(() => parseIds(item.addonIds), [item.addonIds]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    const originalStationsSorted = [...originalStationIds].sort();
    const draftStationsSorted = [...stationDraft].sort();
    const stationsChanged =
      originalStationsSorted.length !== draftStationsSorted.length ||
      originalStationsSorted.some((id, idx) => id !== draftStationsSorted[idx]);

    const addonsChanged = serializeIds(addonDraft) !== serializeIds(originalAddonIds);

    return (
      draft.itemName !== item.itemName ||
      draft.posDisplayName !== item.posDisplayName ||
      draft.kdsName !== (item.kdsName ?? item.itemName) ||
      draft.itemPrice !== item.itemPrice ||
      draft.doordashPrice !== (item.doordashPrice ?? 0) ||
      draft.uberEatsPrice !== (item.uberEatsPrice ?? 0) ||
      draft.grubHubPrice !== (item.grubHubPrice ?? 0) ||
      draft.itemDescription !== item.itemDescription ||
      draft.itemPicture !== (item.itemPicture || '') ||
      draft.kioskItemImage !== (item.kioskItemImage || '') ||
      draft.onlineImage !== (item.onlineImage || '') ||
      draft.thirdPartyImage !== (item.thirdPartyImage || '') ||
      draft.landscapeImage !== (item.landscapeImage || '') ||
      draft.salesTax !== (item.salesTax ?? true) ||
      draft.customTaxId !== item.customTaxId ||
      draft.takeoutException !== (item.takeoutException ?? false) ||
      draft.taxLinkedWithParentSetting !== (item.taxLinkedWithParentSetting ?? true) ||
      draft.stockStatus !== item.stockStatus ||
      draft.orderQuantityLimit !== (item.orderQuantityLimit ?? false) ||
      draft.minLimit !== (item.minLimit ?? 0) ||
      draft.maxLimit !== (item.maxLimit ?? 0) ||
      draft.noMaxLimit !== (item.noMaxLimit ?? true) ||
      draft.inheritModifiersFromCategory !== item.inheritModifiersFromCategory ||
      draft.inheritVisibilityFromCategory !== (item.inheritVisibilityFromCategory === true) ||
      draft.preparationTime !== item.preparationTime ||
      draft.calories !== item.calories ||
      draft.saleCategory !== (item.saleCategory ?? '') ||
      draft.visibilityPos !== (item.visibilityPos ?? true) ||
      draft.visibilityKiosk !== (item.visibilityKiosk ?? true) ||
      draft.visibilityMenuBoard !== (item.visibilityMenuBoard ?? true) ||
      draft.visibilityNugget !== (item.visibilityNugget ?? true) ||
      draft.visibilityQr !== (item.visibilityQr ?? true) ||
      draft.visibilityWebsite !== (item.visibilityWebsite ?? true) ||
      draft.visibilityOnline !== (item.visibilityOnline ?? true) ||
      draft.visibilityMobileApp !== (item.visibilityMobileApp ?? true) ||
      draft.visibilityDoordash !== (item.visibilityDoordash ?? true) ||
      serializeGroupSchedules(draft.daySchedulesByGroup) !== (item.daySchedulesByGroup || serializeGroupSchedules(defaultGroupSchedules())) ||
      pendingModifierIds.length > 0 ||
      pendingRemovedModifierIds.length > 0 ||
      stationsChanged ||
      addonsChanged
    );
  }, [draft, item, pendingModifierIds, pendingRemovedModifierIds, originalStationIds, stationDraft, originalAddonIds, addonDraft]);

  const saleCategoryValid = draft.saleCategory.trim() !== '';
  const maxLimitValid = draft.noMaxLimit || !draft.orderQuantityLimit || draft.maxLimit >= draft.minLimit;

  const itemNameError = getItemNameError(draft.itemName);
  const posNameError = getItemPosNameError(draft.posDisplayName);
  const kdsNameError = getItemKdsNameError(draft.kdsName);
  const isFormValid = !itemNameError && !posNameError && !kdsNameError;

  // Effective tax rate for the live total + the current Select value/label.
  const effectiveTaxRate = effectiveItemTaxRate(draft, customTaxes, taxRate);
  const taxSelectValue = !draft.salesTax
    ? 'none'
    : draft.customTaxId != null && customTaxes.some((t) => t.id === draft.customTaxId)
      ? String(draft.customTaxId)
      : 'standard';
  const handleTaxChange = (value: string) => {
    if (value === 'none') {
      setDraft((d) => ({ ...d, salesTax: false, customTaxId: undefined }));
    } else if (value === 'standard') {
      setDraft((d) => ({ ...d, salesTax: true, customTaxId: undefined }));
    } else {
      setDraft((d) => ({ ...d, salesTax: true, customTaxId: Number(value) }));
    }
  };

  const handleSave = () => {
    // Save item changes
    updateItem(item.id, {
      itemName: draft.itemName,
      posDisplayName: draft.posDisplayName,
      kdsName: draft.kdsName,
      itemPrice: draft.itemPrice,
      doordashPrice: draft.doordashPrice,
      uberEatsPrice: draft.uberEatsPrice,
      grubHubPrice: draft.grubHubPrice,
      itemDescription: draft.itemDescription,
      itemPicture: draft.itemPicture,
      kioskItemImage: draft.kioskItemImage,
      onlineImage: draft.onlineImage,
      thirdPartyImage: draft.thirdPartyImage,
      landscapeImage: draft.landscapeImage,
      salesTax: draft.salesTax,
      customTaxId: draft.customTaxId,
      takeoutException: draft.takeoutException,
      taxLinkedWithParentSetting: draft.taxLinkedWithParentSetting,
      stockStatus: draft.stockStatus,
      orderQuantityLimit: draft.orderQuantityLimit,
      minLimit: draft.minLimit,
      maxLimit: draft.maxLimit,
      noMaxLimit: draft.noMaxLimit,
      inheritModifiersFromCategory: draft.inheritModifiersFromCategory,
      inheritVisibilityFromCategory: draft.inheritVisibilityFromCategory,
      preparationTime: draft.preparationTime,
      calories: draft.calories,
      saleCategory: draft.saleCategory.trim() || 'Food Sales',
      stationIds: [...new Set(stationDraft)].sort((a, b) => a - b).join(','),
      addonIds: serializeIds(addonDraft),
      visibilityPos: draft.visibilityPos,
      visibilityKiosk: draft.visibilityKiosk,
      visibilityMenuBoard: draft.visibilityMenuBoard,
      visibilityNugget: draft.visibilityNugget,
      visibilityQr: draft.visibilityQr,
      visibilityWebsite: draft.visibilityWebsite,
      visibilityOnline: draft.visibilityOnline,
      visibilityMobileApp: draft.visibilityMobileApp,
      visibilityDoordash: draft.visibilityDoordash,
      daySchedulesByGroup: serializeGroupSchedules(draft.daySchedulesByGroup),
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

    // Normalize all sortOrders to the on-screen order so newly-added modifiers
    // land exactly where the user placed them (excluding those being removed).
    setItemModifierOrder(
      item.id,
      modifierOrder.filter((id) => !pendingRemovedModifierIds.includes(id))
    );

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
      doordashPrice: item.doordashPrice ?? 0,
      uberEatsPrice: item.uberEatsPrice ?? 0,
      grubHubPrice: item.grubHubPrice ?? 0,
      itemDescription: item.itemDescription,
      itemPicture: item.itemPicture || '',
      kioskItemImage: item.kioskItemImage || '',
      onlineImage: item.onlineImage || '',
      thirdPartyImage: item.thirdPartyImage || '',
      landscapeImage: item.landscapeImage || '',
      salesTax: item.salesTax ?? true,
      customTaxId: item.customTaxId,
      takeoutException: item.takeoutException ?? false,
      taxLinkedWithParentSetting: item.taxLinkedWithParentSetting ?? true,
      stockStatus: item.stockStatus,
      orderQuantityLimit: item.orderQuantityLimit ?? true,
      minLimit: item.minLimit || 1,
      maxLimit: item.maxLimit || 1,
      noMaxLimit: item.noMaxLimit ?? true,
      inheritModifiersFromCategory: item.inheritModifiersFromCategory,
      inheritVisibilityFromCategory: item.inheritVisibilityFromCategory === true,
      preparationTime: item.preparationTime,
      calories: item.calories,
      saleCategory: item.saleCategory ?? '',
      ...defaultVisibility(),
      visibilityPos: item.visibilityPos ?? true,
      visibilityKiosk: item.visibilityKiosk ?? true,
      visibilityMenuBoard: item.visibilityMenuBoard ?? true,
      visibilityNugget: item.visibilityNugget ?? true,
      visibilityQr: item.visibilityQr ?? true,
      visibilityWebsite: item.visibilityWebsite ?? true,
      visibilityOnline: item.visibilityOnline ?? true,
      visibilityMobileApp: item.visibilityMobileApp ?? true,
      visibilityDoordash: item.visibilityDoordash ?? true,
      daySchedulesByGroup: parseGroupSchedules(item.daySchedulesByGroup, item.daySchedules),
    });
    setExpandedDay(null);
    setBulkStart('');
    setBulkEnd('');
    setPriceInput(item.itemPrice.toFixed(2));
    setDoordashInput(fmt3po(item.doordashPrice));
    setUberEatsInput(fmt3po(item.uberEatsPrice));
    setGrubHubInput(fmt3po(item.grubHubPrice));
    setPendingModifierIds([]);
    setPendingRemovedModifierIds([]);
    setModifierOrder(
      itemModifiers
        .filter((im) => im.itemId === item.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((im) => im.modifierId)
    );
    setStationDraft(originalStationIds);
    setAddonDraft(originalAddonIds);
    setNewStationName('');
    setItemNameDrivesPosKds(namesInitiallyLinked(item));
    setTouched({ itemName: false, posDisplayName: false, kdsName: false });
  };

  const handlePriceChange = (value: string) => {
    setPriceInput(value);
    const price = parseFloat(value);
    if (!isNaN(price) && price >= 0) {
      setDraft(d => ({ ...d, itemPrice: price }));
    }
  };

  const handle3poPriceChange = (
    value: string,
    setInput: (v: string) => void,
    field: 'doordashPrice' | 'uberEatsPrice' | 'grubHubPrice',
  ) => {
    setInput(value);
    const trimmed = value.trim();
    const price = trimmed === '' ? 0 : parseFloat(trimmed);
    if (!isNaN(price) && price >= 0) {
      setDraft(d => ({ ...d, [field]: price }));
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

  // Combine saved and pending modifiers, following the unified display order.
  const allAttachedModifierIds = useMemo(() => {
    const all = [...attachedModifierIds, ...pendingModifierIds];
    const ordered = modifierOrder.filter((id) => all.includes(id));
    // Defensive: append any attached id not yet tracked in modifierOrder.
    const missing = all.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [attachedModifierIds, pendingModifierIds, modifierOrder]);

  const attachedModifiers = useMemo(() => {
    return allAttachedModifierIds
      .map(id => modifiers.find(m => m.id === id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);
  }, [allAttachedModifierIds, modifiers]);

  // Get available modifiers (not yet attached, including pending)
  const availableModifiers = useMemo(() => {
    return modifiers.filter(m => !allAttachedModifierIds.includes(m.id));
  }, [modifiers, allAttachedModifierIds]);

  const inheritedCategoryModifiers = useMemo(() => {
    if (!item.inheritModifiersFromCategory) return [];
    const catEntry = categoryItems.find((ci) => ci.itemId === item.id);
    if (!catEntry) return [];
    // Walk the category chain from the item's own (sub)category up to the root via
    // parentCategoryId, so an item nested in a subcategory also inherits its
    // ancestor categories' modifiers (the POS applies category modifiers down the
    // tree). Cycle-safe. Ordered direct-category first, then up the ancestors.
    const catById = new Map(categories.map((c) => [c.id, c]));
    const chainIndex = new Map<number, number>();
    let cur: number | null = catEntry.categoryId;
    while (cur != null && !chainIndex.has(cur)) {
      chainIndex.set(cur, chainIndex.size);
      cur = catById.get(cur)?.parentCategoryId ?? null;
    }
    const seen = new Set<number>();
    const result: typeof modifiers = [];
    categoryModifiers
      .filter((cm) => chainIndex.has(cm.categoryId))
      .sort((a, b) =>
        (chainIndex.get(a.categoryId)! - chainIndex.get(b.categoryId)!) || (a.sortOrder - b.sortOrder))
      .forEach((cm) => {
        if (seen.has(cm.modifierId)) return;
        seen.add(cm.modifierId);
        const m = modifiers.find((mm) => mm.id === cm.modifierId);
        if (m) result.push(m);
      });
    return result;
  }, [item.id, item.inheritModifiersFromCategory, categoryItems, categoryModifiers, modifiers, categories]);

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
      setModifierOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  };

  const handleApplyGroup = (groupId: number) => {
    const group = modifierGroups.find((g) => g.id === groupId);
    if (!group?.modifierIds) return;
    const idsToAdd = group.modifierIds
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((id) => !isNaN(id) && id > 0 && !allAttachedModifierIds.includes(id));
    setPendingModifierIds((prev) => [...prev, ...idsToAdd.filter((id) => !prev.includes(id))]);
    setModifierOrder((prev) => [...prev, ...idsToAdd.filter((id) => !prev.includes(id))]);
    setGroupPickerOpen(false);
    setGroupPickerSearch('');
  };

  const handleRemoveModifier = (modifierId: number) => {
    // If it's a pending addition, just remove from pending
    if (pendingModifierIds.includes(modifierId)) {
      setPendingModifierIds(pendingModifierIds.filter(id => id !== modifierId));
      setModifierOrder((prev) => prev.filter((id) => id !== modifierId));
    } else {
      // If it's already saved, add to pending removals
      setPendingRemovedModifierIds([...pendingRemovedModifierIds, modifierId]);
    }
  };

  const handleSortModifiers = (dir: 'asc' | 'desc') => {
    const sorted = [...attachedModifiers].sort((a, b) =>
      a.modifierName.localeCompare(b.modifierName, undefined, { sensitivity: 'base' })
    );
    if (dir === 'desc') sorted.reverse();
    const sortedIds = sorted.map((m) => m.id);
    setModifierOrder(sortedIds);
    // Persist the saved subset immediately; pending order rides in modifierOrder
    // until the addition is committed on Save.
    setItemModifierOrder(item.id, sortedIds.filter((id) => attachedModifierIds.includes(id)));
    setSortMenuOpen(false);
  };

  /** (Re)sort one modifier's flat options by name or price and persist the new sortOrder. */
  const handleSortModifierOptions = (
    modifierId: number,
    key: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc',
  ) => {
    const opts = getModifierOptions(modifierId);
    const sorted = [...opts].sort((a, b) => {
      if (key === 'price-asc' || key === 'price-desc') return a.maxLimit - b.maxLimit;
      return (a.option?.optionName || a.optionDisplayName).localeCompare(
        b.option?.optionName || b.optionDisplayName,
        undefined,
        { sensitivity: 'base' },
      );
    });
    if (key === 'name-desc' || key === 'price-desc') sorted.reverse();
    setModifierOptionOrder(modifierId, sorted.map((o) => o.modifierOptionId));
    setOptionSortMenuModifierId(null);
  };

  /** (Re)sort a parent modifier's nested child modifiers by name and persist to modifierIds. */
  const handleSortNestedModifiers = (parentId: number, dir: 'asc' | 'desc') => {
    const nested = getNestedModifiers(parentId);
    const sorted = [...nested].sort((a, b) =>
      (a.posDisplayName || a.modifierName).localeCompare(b.posDisplayName || b.modifierName, undefined, { sensitivity: 'base' })
    );
    if (dir === 'desc') sorted.reverse();
    updateModifier(parentId, { modifierIds: sorted.map((m) => m.id).join(',') });
    setNestedModSortMenuParentId(null);
  };

  /** (Re)sort one nested child modifier's flat options by name or price and persist the new sortOrder. */
  const handleSortNestedModifierOptions = (
    childId: number,
    key: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc',
  ) => {
    const opts = getChildModifierOptions(childId);
    const sorted = [...opts].sort((a, b) => {
      if (key === 'price-asc' || key === 'price-desc') return a.maxLimit - b.maxLimit;
      return (a.option?.optionName || a.optionDisplayName).localeCompare(
        b.option?.optionName || b.optionDisplayName,
        undefined,
        { sensitivity: 'base' },
      );
    });
    if (key === 'name-desc' || key === 'price-desc') sorted.reverse();
    setModifierOptionOrder(childId, sorted.map((o) => o.modifierOptionId));
    setNestedOptionSortMenuChildId(null);
  };

  const handleOptionDragStart = (e: React.DragEvent<HTMLDivElement>, modifierId: number, index: number) => {
    setOptionDragState({ modifierId, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleOptionDragOver = (e: React.DragEvent<HTMLDivElement>, modifierId: number, index: number) => {
    if (!optionDragState || optionDragState.modifierId !== modifierId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (optionDragOverState?.index !== index || optionDragOverState?.modifierId !== modifierId) {
      setOptionDragOverState({ modifierId, index });
    }
  };

  const handleOptionDrop = (e: React.DragEvent<HTMLDivElement>, modifierId: number, index: number) => {
    e.preventDefault();
    if (!optionDragState || optionDragState.modifierId !== modifierId) return;
    const from = optionDragState.index;
    const to = index;
    setOptionDragState(null);
    setOptionDragOverState(null);
    if (from !== to) reorderModifierOptions(modifierId, from, to);
  };

  const handleOptionDragEnd = () => {
    setOptionDragState(null);
    setOptionDragOverState(null);
  };

  const handleModifierDragStart = (e: React.DragEvent<HTMLDivElement>, modifierId: number) => {
    setModDragId(modifierId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(modifierId));
  };

  const handleModifierDragOver = (e: React.DragEvent<HTMLDivElement>, modifierId: number) => {
    if (modDragId === null || modDragId === modifierId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (modDragOverId !== modifierId) setModDragOverId(modifierId);
  };

  const handleModifierDrop = (e: React.DragEvent<HTMLDivElement>, modifierId: number) => {
    e.preventDefault();
    if (modDragId === null || modDragId === modifierId) return;
    const from = modDragId;
    setModDragId(null);
    setModDragOverId(null);

    // Reorder the unified display list, then persist the saved subset live.
    const next = allAttachedModifierIds.slice();
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(modifierId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setModifierOrder(next);
    setItemModifierOrder(item.id, next.filter((id) => attachedModifierIds.includes(id)));
  };

  const handleModifierDragEnd = () => {
    setModDragId(null);
    setModDragOverId(null);
  };

  // Parse tag IDs — exclude 0 and negative (Excel blank cells parse to 0)
  const itemTagIds = item.tagIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0) || [];
  // Only show tags that have a valid id and name (filter persisted phantom entries)
  const validTags = tags.filter(t => t.id > 0 && t.name.trim().length > 0);
  const itemTags = validTags.filter(t => itemTagIds.includes(t.id));

  // Parse allergen IDs — exclude 0 and negative
  const itemAllergenIds = item.allergenIds?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0) || [];
  // Only show allergens that have a valid id and name
  const validAllergens = allergens.filter(a => a.id > 0 && a.name.trim().length > 0);
  const itemAllergens = validAllergens.filter(a => itemAllergenIds.includes(a.id));

  // Cascade: allergens inherited from the categories this item belongs to (when
  // the inherit flag is on, defaulting to true). Shown read-only, deduped
  // against the item's own directly-assigned allergens.
  const inheritAllergens = item.inheritAllergensFromCategory !== false;
  const inheritedCategoryAllergens = useMemo(() => {
    if (!inheritAllergens) return [];
    const catIds = new Set(
      categoryItems.filter((ci) => ci.itemId === item.id).map((ci) => ci.categoryId)
    );
    const inheritedIds = new Set<number>();
    categories
      .filter((c) => catIds.has(c.id))
      .forEach((c) => {
        (c.allergenIds?.split(',') || []).forEach((raw) => {
          const id = parseInt(raw.trim(), 10);
          if (!isNaN(id) && id > 0 && !itemAllergenIds.includes(id)) inheritedIds.add(id);
        });
      });
    return validAllergens.filter((a) => inheritedIds.has(a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inheritAllergens, item.id, categoryItems, categories, allergens, item.allergenIds]);

  // The item's primary category (first assignment). Its channels + schedule are
  // inherited when the visibility inherit toggle is on. Export resolves the same.
  const primaryCategory = useMemo(() => {
    const catEntry = categoryItems.find((ci) => ci.itemId === item.id);
    return catEntry ? categories.find((c) => c.id === catEntry.categoryId) ?? null : null;
  }, [categoryItems, categories, item.id]);

  const inheritedVisibilitySummary = useMemo(() => {
    if (!primaryCategory) return 'No category — nothing to inherit';
    const channels = VISIBILITY_CHANNELS.filter(({ key }) => primaryCategory[key]).map(({ label }) => label);
    const chanPart =
      channels.length === VISIBILITY_CHANNELS.length ? 'All channels'
        : channels.length === 0 ? 'Hidden'
        : channels.join(', ');
    const sched = buildGroupSchedulesSummary(
      parseGroupSchedules(primaryCategory.daySchedulesByGroup, primaryCategory.daySchedules),
    );
    return `${chanPart}  ·  ${sched}`;
  }, [primaryCategory]);

  const toggleItemTag = (tagId: number) => {
    const current = new Set(itemTagIds);
    current.has(tagId) ? current.delete(tagId) : current.add(tagId);
    updateItem(item.id, { tagIds: [...current].join(',') });
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    const id = getNextId('tags');
    addTag({ id, name });
    updateItem(item.id, { tagIds: [...itemTagIds, id].join(',') });
    setNewTagName('');
    setShowTagInput(false);
  };

  const toggleItemAllergen = (allergenId: number) => {
    const current = new Set(itemAllergenIds);
    current.has(allergenId) ? current.delete(allergenId) : current.add(allergenId);
    updateItem(item.id, { allergenIds: [...current].join(',') });
  };

  const handleCreateAllergen = () => {
    const name = newAllergenName.trim();
    if (!name) return;
    const id = getNextId('allergens');
    addAllergen({ id, name });
    updateItem(item.id, { allergenIds: [...itemAllergenIds, id].join(',') });
    setNewAllergenName('');
    setShowAllergenInput(false);
  };

  const handleToggleStation = (stationId: number) => {
    setStationDraft((prev) => {
      if (prev.includes(stationId)) {
        return prev.filter((id) => id !== stationId);
      }
      return [...prev, stationId];
    });
  };

  const handleToggleAddon = (addonItemId: number) => {
    setAddonDraft((prev) => {
      if (prev.includes(addonItemId)) {
        return prev.filter((id) => id !== addonItemId);
      }
      return [...prev, addonItemId];
    });
  };

  // Selectable add-on items — all menu items except this one.
  const addonCandidates = items.filter((i) => i.id !== item.id);
  const filteredAddonCandidates = addonSearch.trim()
    ? addonCandidates.filter((i) =>
        `${i.posDisplayName || i.itemName} ${i.id}`
          .toLowerCase()
          .includes(addonSearch.trim().toLowerCase()),
      )
    : addonCandidates;

  // First available image across channels — used for the small inline preview
  // next to the Images dropdown trigger (falls back to the 16:9 landscape image).
  const itemPreviewImageUrl =
    ITEM_IMAGE_FIELDS.map(({ field }) => draft[field]).find(Boolean) || draft.landscapeImage || '';

  return (
    <div className="flex flex-col h-full">
      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-600 text-xs font-medium">
          You have unsaved changes
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {/* Item name + collapsible POS/KDS overrides */}
        <div className="space-y-1">
          <Label className="section-header">Names</Label>
          <div className="space-y-1">
            <input
              type="text"
              value={draft.itemName}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) =>
                  itemNameDrivesPosKds
                    ? { ...d, itemName: v, posDisplayName: v, kdsName: v }
                    : { ...d, itemName: v },
                );
              }}
              onBlur={() => {
                setDraft((d) => {
                  const trimmed = d.itemName.trim();
                  return itemNameDrivesPosKds
                    ? { ...d, itemName: trimmed, posDisplayName: trimmed, kdsName: trimmed }
                    : { ...d, itemName: trimmed };
                });
                setTouched((t) => ({ ...t, itemName: true }));
              }}
              className="input-field h-8 text-sm font-semibold w-full leading-tight py-1"
              placeholder="Item name"
            />
            {touched.itemName && itemNameError && (
              <p className="text-[10px] text-destructive mt-0.5">{itemNameError}</p>
            )}

            {/* POS / KDS toggle */}
            <button
              type="button"
              onClick={() => setNamesExpanded((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5 pl-0.5"
            >
              {namesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              POS &amp; KDS names
              {!itemNameDrivesPosKds && (
                <span className="ml-1 px-1 py-0.5 rounded bg-muted text-[9px] font-medium text-muted-foreground leading-none">custom</span>
              )}
            </button>

            {namesExpanded && (
              <div className="space-y-1 pl-2 border-l-2 border-border ml-1">
                <div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] leading-tight text-muted-foreground shrink-0 w-8">POS</span>
                    <input
                      type="text"
                      value={draft.posDisplayName}
                      onChange={(e) => {
                        setItemNameDrivesPosKds(false);
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
                    <p className="text-[10px] text-destructive mt-0.5 ml-[2.5rem]">{posNameError}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] leading-tight text-muted-foreground shrink-0 w-8">KDS</span>
                    <input
                      type="text"
                      value={draft.kdsName}
                      onChange={(e) => {
                        setItemNameDrivesPosKds(false);
                        setDraft((d) => ({ ...d, kdsName: e.target.value }));
                      }}
                      onBlur={() => {
                        setDraft((d) => ({ ...d, kdsName: d.kdsName.trim() }));
                        setTouched((t) => ({ ...t, kdsName: true }));
                      }}
                      className="input-field h-7 flex-1 min-w-0 text-xs py-1 leading-tight"
                      placeholder="KDS display name"
                    />
                  </div>
                  {touched.kdsName && kdsNameError && (
                    <p className="text-[10px] text-destructive mt-0.5 ml-[2.5rem]">{kdsNameError}</p>
                  )}
                </div>
                {!itemNameDrivesPosKds && (
                  <button
                    type="button"
                    onClick={() => {
                      setItemNameDrivesPosKds(true);
                      setDraft((d) => ({ ...d, posDisplayName: d.itemName, kdsName: d.itemName }));
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset to item name
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="section-header">Description</Label>
          <textarea
            value={draft.itemDescription}
            onChange={(e) => setDraft(d => ({ ...d, itemDescription: e.target.value }))}
            className="input-field w-full min-h-[56px] resize-none"
            placeholder="Item description (optional)"
          />
        </div>

        {/* Channel-specific item images */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setImagesOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {itemPreviewImageUrl ? (
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border">
                  <LoadingImage src={itemPreviewImageUrl} alt="Item preview" className="h-full w-full object-cover" />
                </span>
              ) : (
                <span
                  title="No image set"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 text-amber-600"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              )}
              Images
              {(ITEM_IMAGE_FIELDS.some(({ field }) => draft[field]) || Boolean(draft.landscapeImage)) && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </span>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', imagesOpen && 'rotate-180')} />
          </button>
          {imagesOpen && (
            <>
          <Label className="text-sm font-medium">
            {ITEM_IMAGE_FIELDS.every(({ field }) => !draft[field]) ? 'Image 1:1' : 'Images 1:1'}
          </Label>
          {ITEM_IMAGE_FIELDS.every(({ field }) => !draft[field]) ? (
            <button
              type="button"
              onClick={() => setImageModalTarget('itemPicture')}
              className="flex h-44 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/40 bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.02] hover:text-foreground"
            >
              <ImageIcon className="mb-4 h-11 w-11 stroke-[1.8]" />
              <span className="text-base font-medium text-foreground">Add image</span>
              <span className="mt-0.5 text-xs">Upload jpg, jpeg, or png</span>
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {ITEM_IMAGE_FIELDS.map(({ field, label }) => {
                  const url = draft[field];
                  return (
                    <div key={field} className="overflow-hidden rounded-lg border border-border bg-muted/20">
                      <div className="relative aspect-square bg-muted/40">
                        {url ? (
                          <LoadingImage src={url} alt={`${label} item`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                            <ImageIcon className="h-6 w-6 opacity-60" />
                            <span className="text-[10px]">No image</span>
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm">
                          {label}
                        </span>
                        {url && (
                          <button
                            type="button"
                            aria-label={`Remove ${label} image`}
                            onClick={() => setDraft((current) => ({ ...current, [field]: '' }))}
                            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageModalTarget(field)}
                        className="inline-flex w-full items-center justify-center gap-1 border-t border-border py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Upload className="h-3 w-3" /> {url ? 'Replace' : 'Upload'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Replace each channel image independently.
              </p>
            </>
          )}

          <div className="pt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Image 16:9</span>
              {draft.landscapeImage && (
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, landscapeImage: '' }))}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            {draft.landscapeImage ? (
              <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
                <div className="relative aspect-video bg-muted/40">
                  <LoadingImage src={draft.landscapeImage} alt="Landscape item" className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => setImageModalTarget('landscapeImage')}
                  className="inline-flex w-full items-center justify-center gap-1 border-t border-border py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Upload className="h-3 w-3" /> Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setImageModalTarget('landscapeImage')}
                className="flex h-44 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/40 bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.02] hover:text-foreground"
              >
                <ImageIcon className="mb-4 h-11 w-11 stroke-[1.8]" />
                <span className="text-base font-medium text-foreground">Add image</span>
                <span className="mt-0.5 text-xs">Upload jpg, jpeg, or png</span>
              </button>
            )}
          </div>
            </>
          )}
        </div>

        {/* Base price — most frequently edited field, kept always visible */}
        <div className="space-y-2.5">
          <Label className="section-header">Base Price</Label>

          {/* Base price + Total price row */}
          <div className="flex items-start gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">Base price*</Label>
              <NumberStepperInput
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => handlePriceChange(e.target.value)}
                onStep={(delta) => handlePriceChange(Math.max(0, (parseFloat(priceInput) || 0) + delta).toFixed(2))}
                prefix={<span className="text-muted-foreground">$</span>}
                wrapperClassName="w-full"
              />
            </div>
            {effectiveTaxRate > 0 && (
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-muted-foreground">Total price</Label>
                <div className="flex items-center gap-2 input-field px-3 py-2 bg-muted/30">
                  <span className="text-muted-foreground">$</span>
                  <span className="text-muted-foreground">
                    {(draft.itemPrice * (1 + effectiveTaxRate / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sale category (required) */}
          <div className="space-y-1">
            <Label htmlFor="saleCategory" className="text-xs text-muted-foreground">Sale category*</Label>
            <SaleCategorySelect
              id="saleCategory"
              value={draft.saleCategory}
              onChange={(v) => setDraft(d => ({ ...d, saleCategory: v }))}
              triggerClassName="input-field"
            />
            {!saleCategoryValid && (
              <p className="text-xs text-destructive">Required.</p>
            )}
          </div>
        </div>

        {/* Stock */}
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

        {/* Technical sections — collapsed by default */}
        <Accordion
          type="multiple"
          defaultValue={[]}
          className="rounded-lg border border-border bg-muted/10 overflow-hidden"
        >
          <AccordionItem value="third-party" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Third-party delivery prices
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Optional per-platform prices. Leave blank to inherit the base price
                  {draft.itemPrice > 0 ? ` ($${draft.itemPrice.toFixed(2)})` : ''}.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { label: 'DoorDash', value: doordashInput, setInput: setDoordashInput, field: 'doordashPrice' as const },
                    { label: 'UberEats', value: uberEatsInput, setInput: setUberEatsInput, field: 'uberEatsPrice' as const },
                    { label: 'GrubHub',  value: grubHubInput,  setInput: setGrubHubInput,  field: 'grubHubPrice' as const },
                  ]).map(({ label, value, setInput, field }) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <NumberStepperInput
                        inputMode="decimal"
                        placeholder={draft.itemPrice > 0 ? draft.itemPrice.toFixed(2) : '0.00'}
                        value={value}
                        onChange={(e) => handle3poPriceChange(e.target.value, setInput, field)}
                        onStep={(delta) =>
                          handle3poPriceChange(Math.max(0, (parseFloat(value) || 0) + delta).toFixed(2), setInput, field)
                        }
                        prefix={<span className="text-muted-foreground">$</span>}
                        wrapperClassName="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
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
                  {stationDraft.map((id) => {
                    const st = stations.find((s) => s.id === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleToggleStation(id)}
                        className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center gap-1"
                      >
                        <span>Station {id}{st?.label ? ` — ${st.label}` : ''}</span>
                        <span className="text-[10px] leading-none">✕</span>
                      </button>
                    );
                  })}
                </div>
                {stations.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {stations.map((station) => (
                      <label
                        key={station.id}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <Checkbox
                          checked={stationDraft.includes(station.id)}
                          onCheckedChange={() => handleToggleStation(station.id)}
                        />
                        <span className="text-muted-foreground">
                          Station {station.id}{station.label ? ` — ${station.label}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label
                    htmlFor="inheritMods"
                    title="Inherit modifiers from category"
                    className="flex items-center gap-1.5 text-xs font-medium cursor-pointer mr-auto"
                  >
                    Inherit
                    <Switch
                      id="inheritMods"
                      checked={draft.inheritModifiersFromCategory}
                      onCheckedChange={(checked) =>
                        setDraft((d) => ({ ...d, inheritModifiersFromCategory: checked }))
                      }
                    />
                  </label>
                  <div className="flex items-center gap-2">
                  {/* Sort modifiers */}
                  {attachedModifiers.length > 1 && (
                    <div className="relative" ref={sortMenuRef}>
                      <button
                        type="button"
                        onClick={() => setSortMenuOpen((o) => !o)}
                        className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-muted/50 transition-colors"
                        title="Sort modifiers"
                      >
                        <ArrowDownUp className="w-3.5 h-3.5" />
                      </button>
                      {sortMenuOpen && (
                        <div className="absolute z-20 right-0 top-full mt-1 w-36 rounded-md border border-border bg-background shadow-md py-1">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                            onClick={() => handleSortModifiers('asc')}
                          >
                            Name (A → Z)
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                            onClick={() => handleSortModifiers('desc')}
                          >
                            Name (Z → A)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Apply modifier group picker */}
                  {modifierGroups.length > 0 && (
                    <div className="relative" ref={groupPickerRef}>
                      <button
                        type="button"
                        onClick={() => { setGroupPickerOpen((o) => !o); setGroupPickerSearch(''); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-muted/50 transition-colors"
                        title="Apply modifier group"
                      >
                        <Layers className="w-3 h-3" />
                        Group
                      </button>
                      {groupPickerOpen && (
                        <div className="absolute z-20 right-0 top-full mt-1 w-52 rounded-md border border-border bg-background shadow-md">
                          <div className="p-1.5 border-b border-border">
                            <input
                              type="text"
                              value={groupPickerSearch}
                              onChange={(e) => setGroupPickerSearch(e.target.value)}
                              placeholder="Search groups…"
                              className="input-field h-7 text-xs w-full"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {modifierGroups
                              .filter((g) => !groupPickerSearch || g.groupName.toLowerCase().includes(groupPickerSearch.toLowerCase()))
                              .map((g) => (
                                <button
                                  key={g.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                                  onClick={() => handleApplyGroup(g.id)}
                                >
                                  <span>{g.groupName}</span>
                                  <span className="text-muted-foreground/60 text-[10px]">
                                    {g.modifierIds ? g.modifierIds.split(',').filter(Boolean).length : 0} mods
                                  </span>
                                </button>
                              ))}
                            {modifierGroups.filter((g) => !groupPickerSearch || g.groupName.toLowerCase().includes(groupPickerSearch.toLowerCase())).length === 0 && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {availableModifiers.length > 0 && (
                    <div className="relative" ref={modPickerRef}>
                      <button
                        type="button"
                        onClick={() => { setModPickerOpen((o) => !o); setModPickerSearch(''); }}
                        className="btn-add"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                      {modPickerOpen && (
                        <div className="absolute z-20 right-0 top-full mt-1 w-56 rounded-md border border-border bg-background shadow-md">
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
                            {availableModifiers
                              .filter((mod) => !modPickerSearch || mod.modifierName.toLowerCase().includes(modPickerSearch.toLowerCase()))
                              .map((mod) => (
                                <button
                                  key={mod.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
                                  onClick={() => { handleAddModifier(mod.id.toString()); setModPickerOpen(false); }}
                                >
                                  <span className="truncate">{mod.modifierName}</span>
                                  <span className="text-muted-foreground/60 text-[10px] shrink-0">#{mod.id}</span>
                                </button>
                              ))}
                            {availableModifiers.filter((mod) => !modPickerSearch || mod.modifierName.toLowerCase().includes(modPickerSearch.toLowerCase())).length === 0 && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    className="btn-add"
                    onClick={() => setIsCreatingModifier(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </button>
                  </div>
                </div>

                {inheritedCategoryModifiers.length > 0 && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">
                      Inherited from category
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {inheritedCategoryModifiers.map((m) => m.modifierName).join('  ·  ')}
                    </p>
                  </div>
                )}

                {attachedModifiers.length > 0 ? (
                  <Accordion type="multiple" className="space-y-1">
              {attachedModifiers.map((modifier) => {
                const options = getModifierOptions(modifier.id);
                const isPending = pendingModifierIds.includes(modifier.id);
                const isPendingRemoval = pendingRemovedModifierIds.includes(modifier.id);
                const isDraggable = !isPendingRemoval;
                return (
                  <div
                    key={modifier.id}
                    draggable={isDraggable}
                    onDragStart={isDraggable ? (e) => handleModifierDragStart(e, modifier.id) : undefined}
                    onDragOver={isDraggable ? (e) => handleModifierDragOver(e, modifier.id) : undefined}
                    onDrop={isDraggable ? (e) => handleModifierDrop(e, modifier.id) : undefined}
                    onDragEnd={isDraggable ? handleModifierDragEnd : undefined}
                    className={cn(
                      "transition-opacity",
                      modDragId === modifier.id && "opacity-40",
                      modDragOverId === modifier.id && "ring-2 ring-primary ring-inset rounded-md",
                    )}
                  >
                  <AccordionItem
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
                          {isDraggable && (
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing" />
                          )}
                          <span className="flex items-center gap-1.5">
                            {modifier.modifierName}
                            <span className="text-xs text-muted-foreground/60 font-normal">#{modifier.id}</span>
                          </span>
                          {isPending && (
                            <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
                              New
                            </span>
                          )}
                          <ModTypeBadge mod={modifier} />
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToModifier(modifier.id);
                            }}
                            className="p-1 text-muted-foreground hover:text-primary"
                            title="Edit in modifier library"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
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
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>
                              {modifier.isOptional?.trim()
                                ? `${modifier.isOptional} • `
                                : ''}
                              Min: {modifier.minSelector} / Max: {modifier.noMaxSelection ? '∞' : modifier.maxSelector}
                            </span>
                            {modifier.pizzaSelection && (
                              <span className="bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded font-medium">Pizza</span>
                            )}
                            {modifier.isSizeModifier && (
                              <span className="bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded font-medium">Size</span>
                            )}
                          </div>
                          {options.length > 1 && (
                            <div className="relative" ref={optionSortMenuModifierId === modifier.id ? optionSortMenuRef : undefined}>
                              <button
                                type="button"
                                onClick={() =>
                                  setOptionSortMenuModifierId((id) => (id === modifier.id ? null : modifier.id))
                                }
                                className="flex items-center justify-center w-6 h-6 rounded-md border border-border hover:bg-muted/50 transition-colors shrink-0"
                                title="Sort options"
                              >
                                <ArrowDownUp className="w-3 h-3" />
                              </button>
                              {optionSortMenuModifierId === modifier.id && (
                                <div className="absolute z-20 right-0 top-full mt-1 w-40 rounded-md border border-border bg-background shadow-md py-1">
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSortModifierOptions(modifier.id, 'name-asc')}
                                  >
                                    Name (A → Z)
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSortModifierOptions(modifier.id, 'name-desc')}
                                  >
                                    Name (Z → A)
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSortModifierOptions(modifier.id, 'price-asc')}
                                  >
                                    Price (Low → High)
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSortModifierOptions(modifier.id, 'price-desc')}
                                  >
                                    Price (High → Low)
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {options.map((opt, optIdx) => (
                          <div
                            key={opt.modifierOptionId}
                            draggable
                            onDragStart={(e) => handleOptionDragStart(e, modifier.id, optIdx)}
                            onDragOver={(e) => handleOptionDragOver(e, modifier.id, optIdx)}
                            onDrop={(e) => handleOptionDrop(e, modifier.id, optIdx)}
                            onDragEnd={handleOptionDragEnd}
                            className={cn(
                              "flex items-center gap-2 text-sm rounded px-1 transition-opacity",
                              optionDragState?.modifierId === modifier.id && optionDragState?.index === optIdx && "opacity-40",
                              optionDragOverState?.modifierId === modifier.id && optionDragOverState?.index === optIdx &&
                                optionDragState?.index !== optIdx && "ring-2 ring-primary ring-inset",
                            )}
                          >
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0" />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span>{opt.option?.optionName || opt.optionDisplayName}</span>
                              {opt.isDefaultSelected && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground shrink-0">
                              {modifier.isSizeModifier ? (
                                <>
                                  ${(opt.maxLimit > 0 ? opt.maxLimit : 0).toFixed(2)}
                                  {effectiveTaxRate > 0 && (
                                    <span className="ml-1 text-muted-foreground/70">
                                      (${((opt.maxLimit > 0 ? opt.maxLimit : 0) * (1 + effectiveTaxRate / 100)).toFixed(2)} w/ tax)
                                    </span>
                                  )}
                                </>
                              ) : opt.maxLimit > 0 ? (
                                `+$${opt.maxLimit.toFixed(2)}`
                              ) : (
                                '$0.00'
                              )}
                            </span>
                          </div>
                        ))}
                        {/* Nested modifiers */}
                        {(() => {
                          const nested = getNestedModifiers(modifier.id);
                          if (nested.length === 0) return null;
                          return (
                            <div className="mt-3 pt-2 border-t border-border/50 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Nested modifiers:
                                </p>
                                {nested.length > 1 && (
                                  <div
                                    className="relative"
                                    ref={nestedModSortMenuParentId === modifier.id ? nestedModSortMenuRef : undefined}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNestedModSortMenuParentId((id) => (id === modifier.id ? null : modifier.id))
                                      }
                                      className="flex items-center justify-center w-6 h-6 rounded-md border border-border hover:bg-muted/50 transition-colors shrink-0"
                                      title="Sort nested modifiers"
                                    >
                                      <ArrowDownUp className="w-3 h-3" />
                                    </button>
                                    {nestedModSortMenuParentId === modifier.id && (
                                      <div className="absolute z-20 right-0 top-full mt-1 w-36 rounded-md border border-border bg-background shadow-md py-1">
                                        <button
                                          type="button"
                                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                          onClick={() => handleSortNestedModifiers(modifier.id, 'asc')}
                                        >
                                          Name (A → Z)
                                        </button>
                                        <button
                                          type="button"
                                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                          onClick={() => handleSortNestedModifiers(modifier.id, 'desc')}
                                        >
                                          Name (Z → A)
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
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
                                        {childOpts.length > 1 && (
                                          <div className="flex items-center justify-end mb-1">
                                            <div
                                              className="relative"
                                              ref={nestedOptionSortMenuChildId === child.id ? nestedOptionSortMenuRef : undefined}
                                            >
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setNestedOptionSortMenuChildId((id) => (id === child.id ? null : child.id))
                                                }
                                                className="flex items-center justify-center w-6 h-6 rounded-md border border-border hover:bg-muted/50 transition-colors shrink-0"
                                                title="Sort options"
                                              >
                                                <ArrowDownUp className="w-3 h-3" />
                                              </button>
                                              {nestedOptionSortMenuChildId === child.id && (
                                                <div className="absolute z-20 right-0 top-full mt-1 w-40 rounded-md border border-border bg-background shadow-md py-1">
                                                  <button
                                                    type="button"
                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                                    onClick={() => handleSortNestedModifierOptions(child.id, 'name-asc')}
                                                  >
                                                    Name (A → Z)
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                                    onClick={() => handleSortNestedModifierOptions(child.id, 'name-desc')}
                                                  >
                                                    Name (Z → A)
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                                    onClick={() => handleSortNestedModifierOptions(child.id, 'price-asc')}
                                                  >
                                                    Price (Low → High)
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                                                    onClick={() => handleSortNestedModifierOptions(child.id, 'price-desc')}
                                                  >
                                                    Price (High → Low)
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
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
                  </div>
                );
              })}
            </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground">No modifiers attached</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="availability" className="border-b border-border px-3">
            <AccordionTrigger className="px-0 py-3 hover:no-underline items-start gap-2 [&>svg]:mt-1">
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Availability</div>
                <div className="text-[10px] font-normal normal-case text-muted-foreground truncate mt-0.5 pr-2">
                  {draft.inheritVisibilityFromCategory
                    ? `Inherited · ${inheritedVisibilitySummary}`
                    : buildAvailabilitySummary(draft)}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {/* Inherit visibility from category — overrides the editor below when on */}
                <label
                  htmlFor="inheritVisibility"
                  title="Inherit channels & schedule from category"
                  className="flex items-center justify-between gap-1.5 text-xs font-medium cursor-pointer"
                >
                  Inherit from category
                  <Switch
                    id="inheritVisibility"
                    checked={draft.inheritVisibilityFromCategory}
                    onCheckedChange={(checked) =>
                      setDraft((d) => ({ ...d, inheritVisibilityFromCategory: checked }))
                    }
                  />
                </label>

                {draft.inheritVisibilityFromCategory ? (
                  <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2.5 space-y-1">
                    <p className="text-[11px] font-medium text-foreground">{inheritedVisibilitySummary}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Channels &amp; schedule follow this item’s category. Turn off to set an override.
                    </p>
                  </div>
                ) : (
                /* Channel dropdowns — per-group schedule editor inside each */
                <div className="space-y-1.5">
                  {Object.entries(getChannelsByGroup()).map(([group, channels]) => {
                    const isOpen = openChannelGroup === group;
                    const active = channels.filter(c => draft[c.key]);
                    const triggerLabel =
                      active.length === 0 ? 'None' :
                      active.length === channels.length ? 'All' :
                      active.map(c => c.label).join(', ');
                    const groupKey = group as VisibilityGroup;
                    const groupSched = draft.daySchedulesByGroup[groupKey];
                    return (
                      <div key={group}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenChannelGroup(isOpen ? null : group);
                            setExpandedDay(null);
                            setBulkStart('');
                            setBulkEnd('');
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
                            isOpen ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50',
                          )}
                        >
                          <span className="font-medium text-foreground">{group}</span>
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className={cn(active.length > 0 && active.length < channels.length && 'text-primary')}>{triggerLabel}</span>
                            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="mt-0.5 rounded-md border border-border overflow-hidden">
                            {/* Channel checkboxes */}
                            <div className="divide-y divide-border">
                              {channels.map(({ key, label }) => {
                                const checked = draft[key];
                                return (
                                  <label key={key} className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                                    <span className={cn('text-xs', checked ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                                    <input type="checkbox" checked={checked} onChange={() => setDraft(d => toggleVisibilityChannel(d, key))} className="accent-primary cursor-pointer" />
                                  </label>
                                );
                              })}
                            </div>

                            {/* Schedule for this group */}
                            <div className="border-t border-border px-3 py-2 space-y-2 bg-muted/20">
                              {/* Bulk hours */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hours (all days)</p>
                                  {(bulkStart || bulkEnd) && (
                                    <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => { setBulkStart(''); setBulkEnd(''); }}>Clear</button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
                                    <input type="time" value={bulkStart} onChange={e => setBulkStart(e.target.value)} className="input-field flex-1 text-sm" />
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
                                    <input type="time" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} className="input-field flex-1 text-sm" />
                                  </div>
                                  <button type="button" disabled={!bulkStart && !bulkEnd}
                                    onClick={() => {
                                      setDraft(prev => {
                                        const next = { ...prev.daySchedulesByGroup[groupKey] };
                                        for (const d of SCHEDULE_DAYS) {
                                          if (next[d].enabled) next[d] = { ...next[d], start: bulkStart, end: bulkEnd };
                                        }
                                        return { ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: next } };
                                      });
                                    }}
                                    className="text-xs px-2.5 py-1.5 rounded-md border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap">
                                    Apply to all
                                  </button>
                                </div>
                                {!bulkStart && !bulkEnd && <p className="text-[10px] text-muted-foreground">Set times above then click Apply.</p>}
                              </div>

                              {/* Per-day toggles */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Days</p>
                                  <button type="button" className="text-xs text-primary hover:underline"
                                    onClick={() => {
                                      const allEnabled = SCHEDULE_DAYS.every(d => groupSched[d].enabled);
                                      setDraft(prev => {
                                        const next = { ...prev.daySchedulesByGroup[groupKey] };
                                        for (const d of SCHEDULE_DAYS) next[d] = { ...next[d], enabled: !allEnabled };
                                        return { ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: next } };
                                      });
                                    }}>
                                    {SCHEDULE_DAYS.every(d => groupSched[d].enabled) ? 'All days' : 'Select all'}
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {SCHEDULE_DAYS.map(day => {
                                    const sched = groupSched[day];
                                    const isExpanded = expandedDay === day;
                                    const hasTime = sched.start || sched.end;
                                    return (
                                      <button key={day} type="button"
                                        onClick={() => {
                                          if (!sched.enabled) {
                                            setDraft(prev => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [day]: { ...sched, enabled: true } } } }));
                                            setExpandedDay(day);
                                          } else if (isExpanded) {
                                            setExpandedDay(null);
                                          } else {
                                            setExpandedDay(day);
                                          }
                                        }}
                                        className={cn("px-2 py-1.5 rounded text-xs font-medium transition-colors border min-w-[36px]",
                                          sched.enabled ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border")}>
                                        {day.slice(0, 1)}{sched.enabled && hasTime ? ' ·' : ''}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Expanded day time editor */}
                                {expandedDay && groupSched[expandedDay].enabled && (
                                  <div className="mt-2 p-3 rounded-md border border-border bg-muted/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-medium">{expandedDay} hours</p>
                                      <div className="flex gap-2">
                                        {(groupSched[expandedDay].start || groupSched[expandedDay].end) && (
                                          <button type="button" className="text-xs text-muted-foreground hover:underline"
                                            onClick={() => setDraft(prev => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { ...prev.daySchedulesByGroup[groupKey][expandedDay], start: '', end: '' } } } }))}>
                                            Clear
                                          </button>
                                        )}
                                        <button type="button" className="text-xs text-destructive hover:underline"
                                          onClick={() => {
                                            setDraft(prev => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { enabled: false, start: '', end: '' } } } }));
                                            setExpandedDay(null);
                                          }}>
                                          Disable day
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1.5 flex-1">
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
                                        <input type="time" value={groupSched[expandedDay].start}
                                          onChange={e => setDraft(prev => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { ...prev.daySchedulesByGroup[groupKey][expandedDay], start: e.target.value } } } }))}
                                          className="input-field flex-1 text-sm" />
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-1">
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
                                        <input type="time" value={groupSched[expandedDay].end}
                                          onChange={e => setDraft(prev => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { ...prev.daySchedulesByGroup[groupKey][expandedDay], end: e.target.value } } } }))}
                                          className="input-field flex-1 text-sm" />
                                      </div>
                                    </div>
                                    {!groupSched[expandedDay].start && !groupSched[expandedDay].end && (
                                      <p className="text-xs text-muted-foreground">All hours (no restriction)</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>{/* end AccordionContent space-y-4 */}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="taxes" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Taxes
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pb-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="tax" className="text-xs text-muted-foreground">Tax</Label>
                    <button
                      type="button"
                      title={draft.taxLinkedWithParentSetting ? 'Tax linked to category (click to unlink)' : 'Tax unlinked from category (click to link)'}
                      onClick={() => setDraft(d => ({ ...d, taxLinkedWithParentSetting: !d.taxLinkedWithParentSetting }))}
                      className={`rounded p-0.5 transition-colors ${draft.taxLinkedWithParentSetting ? 'text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    >
                      {draft.taxLinkedWithParentSetting ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                    </button>
                  </div>
                  <Select value={taxSelectValue} onValueChange={handleTaxChange}>
                    <SelectTrigger id="tax" className="input-field">
                      <SelectValue>
                        {taxSelectValue === 'none'
                          ? 'No tax'
                          : taxSelectValue === 'standard'
                            ? `Standard · ${taxRate}%`
                            : (() => {
                                const t = customTaxes.find((c) => c.id === draft.customTaxId);
                                return t ? `${t.name} · ${t.rate}%` : `Standard · ${taxRate}%`;
                              })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectOption value="none">No sales tax</SelectOption>
                      <SelectOption value="standard">{`Standard rate (${taxRate}%)`}</SelectOption>
                      {customTaxes.map((t) => (
                        <SelectOption key={t.id} value={String(t.id)}>
                          {`${t.name} · ${t.rate}%`}
                        </SelectOption>
                      ))}
                      <div className="border-t mt-1 pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveTab('settings')}
                          className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
                        >
                          Manage custom taxes
                        </button>
                      </div>
                    </SelectContent>
                  </Select>
                </div>

                {/* Takeout exception */}
                {effectiveTaxRate > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="takeoutException" className="text-sm font-normal cursor-pointer">Takeout exception</Label>
                    <Switch
                      id="takeoutException"
                      checked={draft.takeoutException}
                      onCheckedChange={(checked) => setDraft(d => ({ ...d, takeoutException: checked }))}
                    />
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tags" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                Tags
                <span className="text-[10px] font-normal normal-case tabular-nums text-muted-foreground/80">
                  ({itemTags.length}/{validTags.length})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {validTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tags exist yet. Create one below.</p>
                ) : (
                  <TooltipProvider delayDuration={900}>
                    <div className="flex flex-wrap gap-1.5">
                      {validTags.map((tag) => {
                        const isAssigned = itemTagIds.includes(tag.id);
                        const isPendingDelete = pendingDeleteTagId === tag.id;
                        const TagIcon = resolveTagIcon(tag.icon);

                        if (isPendingDelete) {
                          return (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-destructive/10 border-destructive/40 text-destructive"
                            >
                              <span>Delete "{tag.name}"?</span>
                              <button
                                type="button"
                                onClick={() => { deleteTag(tag.id); setPendingDeleteTagId(null); }}
                                className="text-destructive hover:text-destructive/70 font-bold"
                                title="Confirm delete"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteTagId(null)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        }

                        // Icon tile — big colored square; controls stay inside bounds
                        if (TagIcon) {
                          const bgColor = tag.color || '#6366f1';
                          return (
                            <Tooltip key={tag.id}>
                              <div className="group relative">
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      'w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer select-none transition-opacity',
                                      isAssigned ? 'opacity-100' : 'opacity-35 hover:opacity-60',
                                    )}
                                    style={{ backgroundColor: bgColor }}
                                    onClick={() => toggleItemTag(tag.id)}
                                  >
                                    <TagIcon className="w-[18px] h-[18px] text-white drop-shadow-sm" />
                                  </div>
                                </TooltipTrigger>
                                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-start justify-end p-0.5">
                                  <div className="pointer-events-auto flex gap-0.5">
                                    <TagIconPicker
                                      icon={tag.icon}
                                      color={tag.color}
                                      onChangeIcon={(iconName) => updateTag(tag.id, { icon: iconName })}
                                      onChangeColor={(color) => updateTag(tag.id, { color })}
                                      triggerClassName="w-4 h-4 rounded bg-black/30 hover:bg-black/50 flex items-center justify-center text-white"
                                    />
                                    {!tag.isSystem && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setPendingDeleteTagId(tag.id); }}
                                        className="w-4 h-4 rounded bg-black/30 hover:bg-black/50 flex items-center justify-center text-white"
                                        title="Delete tag globally"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <TooltipContent side="bottom" className="text-xs px-2 py-1">
                                {tag.name}
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        // Text chip — existing style when no icon
                        return (
                          <span
                            key={tag.id}
                            className={cn(
                              'group inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer select-none transition-colors',
                              isAssigned
                                ? 'bg-muted border-primary/40 text-foreground'
                                : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                            )}
                            onClick={() => toggleItemTag(tag.id)}
                          >
                            {isAssigned && <Check className="w-2.5 h-2.5 shrink-0 text-primary" />}
                            <span>{tag.name}</span>
                            <TagIconPicker
                              icon={tag.icon}
                              color={tag.color}
                              onChangeIcon={(iconName) => updateTag(tag.id, { icon: iconName })}
                              onChangeColor={(color) => updateTag(tag.id, { color })}
                            />
                            {!tag.isSystem && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setPendingDeleteTagId(tag.id); }}
                                className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                title="Delete tag globally"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                )}
                {showTagInput ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') { setShowTagInput(false); setNewTagName(''); } }}
                      placeholder="Tag name..."
                      className="input-field flex-1 text-xs"
                      autoFocus
                    />
                    <button type="button" onClick={handleCreateTag} className="btn-add px-2 py-1 text-xs">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                    <button type="button" onClick={() => { setShowTagInput(false); setNewTagName(''); }} className="text-xs text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTagInput(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <Plus className="w-3 h-3" /> New tag
                  </button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="allergens" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                Allergens
                <span className="text-[10px] font-normal normal-case tabular-nums text-muted-foreground/80">
                  ({itemAllergens.length}/{validAllergens.length})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <label
                  htmlFor="inheritAllergens"
                  title="Inherit allergens from category"
                  className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                >
                  Inherit from category
                  <Switch
                    id="inheritAllergens"
                    checked={inheritAllergens}
                    onCheckedChange={(checked) =>
                      updateItem(item.id, { inheritAllergensFromCategory: checked })
                    }
                  />
                </label>
                {inheritedCategoryAllergens.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {inheritedCategoryAllergens.map((allergen) => (
                      <span
                        key={`inherited-${allergen.id}`}
                        title="Inherited from category"
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-dashed bg-destructive/5 border-destructive/30 text-destructive/80"
                      >
                        <span>{allergen.name}</span>
                        <span className="text-[9px] uppercase tracking-wide opacity-70">cat</span>
                      </span>
                    ))}
                  </div>
                )}
                {validAllergens.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No allergens exist yet. Create one below.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {validAllergens.map((allergen) => {
                      const isAssigned = itemAllergenIds.includes(allergen.id);
                      const isPendingDelete = pendingDeleteAllergenId === allergen.id;
                      if (isPendingDelete) {
                        return (
                          <span
                            key={allergen.id}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-destructive/10 border-destructive/40 text-destructive"
                          >
                            <span>Delete "{allergen.name}"?</span>
                            <button
                              type="button"
                              onClick={() => { deleteAllergen(allergen.id); setPendingDeleteAllergenId(null); }}
                              className="text-destructive hover:text-destructive/70 font-bold"
                              title="Confirm delete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteAllergenId(null)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      }
                      return (
                        <span
                          key={allergen.id}
                          className={cn(
                            'group inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer select-none transition-colors',
                            isAssigned
                              ? 'bg-destructive/15 border-destructive/40 text-destructive'
                              : 'bg-muted/40 border-border text-muted-foreground hover:border-destructive/30 hover:text-foreground',
                          )}
                          onClick={() => toggleItemAllergen(allergen.id)}
                        >
                          {isAssigned && <Check className="w-2.5 h-2.5 shrink-0" />}
                          <span>{allergen.name}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPendingDeleteAllergenId(allergen.id); }}
                            className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            title="Delete allergen globally"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {showAllergenInput ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={newAllergenName}
                      onChange={(e) => setNewAllergenName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAllergen(); if (e.key === 'Escape') { setShowAllergenInput(false); setNewAllergenName(''); } }}
                      placeholder="Allergen name..."
                      className="input-field flex-1 text-xs"
                      autoFocus
                    />
                    <button type="button" onClick={handleCreateAllergen} className="btn-add px-2 py-1 text-xs">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                    <button type="button" onClick={() => { setShowAllergenInput(false); setNewAllergenName(''); }} className="text-xs text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAllergenInput(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <Plus className="w-3 h-3" /> New allergen
                  </button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="addons" className="border-b border-border px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2">
                Add-Ons
                {addonDraft.length > 0 && (
                  <span className="text-[10px] font-normal normal-case tabular-nums text-muted-foreground/80">
                    ({addonDraft.length})
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Link other menu items as add-ons for this item.
                </p>
                {addonCandidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other items exist yet.</p>
                ) : (
                  <>
                    <input
                      type="text"
                      value={addonSearch}
                      onChange={(e) => setAddonSearch(e.target.value)}
                      placeholder="Search items..."
                      className="input-field w-full text-xs"
                    />
                    {filteredAddonCandidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No items match your search.</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {filteredAddonCandidates.map((candidate) => (
                          <label
                            key={candidate.id}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <Checkbox
                              checked={addonDraft.includes(candidate.id)}
                              onCheckedChange={() => handleToggleAddon(candidate.id)}
                            />
                            <span className="text-muted-foreground">
                              {candidate.posDisplayName || candidate.itemName}
                            </span>
                            <span className="text-muted-foreground/50 tabular-nums">#{candidate.id}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

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
                        <NumberStepperInput
                          inputMode="numeric"
                          value={draft.minLimit}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            setDraft(d => ({
                              ...d,
                              minLimit: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          onStep={(delta) =>
                            setDraft(d => ({ ...d, minLimit: Math.max(0, d.minLimit + delta) }))
                          }
                          wrapperClassName="w-full"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Maximum</Label>
                        <NumberStepperInput
                          inputMode="numeric"
                          value={draft.maxLimit}
                          disabled={draft.noMaxLimit}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            setDraft(d => ({
                              ...d,
                              maxLimit: Math.max(1, parseInt(e.target.value, 10) || 1),
                            }))
                          }
                          onStep={(delta) =>
                            setDraft(d => ({ ...d, maxLimit: Math.max(1, d.maxLimit + delta) }))
                          }
                          wrapperClassName="w-full"
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

          <AccordionItem value="kitchen-details" className="border-b-0 px-3">
            <AccordionTrigger className="py-3 hover:no-underline text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kitchen & details
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prep time (min)</span>
                  <NumberStepperInput
                    inputMode="numeric"
                    value={draft.preparationTime}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDraft(d => ({ ...d, preparationTime: Math.max(0, parseInt(e.target.value) || 0) }))}
                    onStep={(delta) => setDraft(d => ({ ...d, preparationTime: Math.max(0, d.preparationTime + delta) }))}
                    wrapperClassName="w-20"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Calories (kcal)</span>
                  <NumberStepperInput
                    inputMode="numeric"
                    value={draft.calories}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDraft(d => ({ ...d, calories: Math.max(0, parseInt(e.target.value) || 0) }))}
                    onStep={(delta) => setDraft(d => ({ ...d, calories: Math.max(0, d.calories + delta) }))}
                    wrapperClassName="w-20"
                    aria-label="Calories in kilocalories"
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
          disabled={!hasChanges || !saleCategoryValid || !maxLimitValid || !isFormValid}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      <CategoryImageLibraryModal
        open={imageModalTarget != null}
        title={imageModalTarget === 'landscapeImage'
          ? 'Landscape image'
          : `${ITEM_IMAGE_FIELDS.find(({ field }) => field === imageModalTarget)?.label ?? 'Item'} image`}
        onOpenChange={(open) => { if (!open) setImageModalTarget(null); }}
        onSelect={(url) => {
          if (!imageModalTarget) return;
          const patch: Partial<DraftState> = imageModalTarget === 'landscapeImage'
            ? { landscapeImage: url }
            : ITEM_IMAGE_FIELDS.every(({ field }) => !draft[field])
              // The first image chosen seeds all channel-specific fields.
              ? { itemPicture: url, kioskItemImage: url, onlineImage: url, thirdPartyImage: url }
              : { [imageModalTarget]: url };
          setDraft((current) => ({ ...current, ...patch }));
          // Images upload to permanent storage immediately, so persist right
          // away instead of waiting for the user to click Save.
          updateItem(item.id, patch);
        }}
      />

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
