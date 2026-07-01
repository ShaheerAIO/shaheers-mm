import { useState, useEffect, useRef } from 'react';
import { Check, X, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { TagIconPicker } from '@/components/tags/TagIconPicker';
import { resolveTagIcon } from '@/lib/tagIcons';
import { ColorPalettePicker } from '@/components/ColorPalettePicker';
import { CATEGORY_COLOR_PALETTE, DEFAULT_CATEGORY_COLOR } from '@/lib/posColors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import {
  VISIBILITY_CHANNELS,
  DAYS,
  parseGroupSchedules,
  serializeGroupSchedules,
  buildGroupSchedulesSummary,
  defaultGroupSchedules,
  type ChannelGroupSchedules,
  type DayKey,
  type VisibilityChannelKey,
  type VisibilityGroup,
} from '@/lib/visibility';
import type { Category } from '@/types/menu';

type VisDraft = Pick<Category,
  'visibilityPos' | 'visibilityKiosk' | 'visibilityMenuBoard' | 'visibilityQr' |
  'visibilityWebsite' | 'visibilityMobileApp' | 'visibilityDoordash'
>;

type Draft = {
  categoryName: string;
  posDisplayName: string;
  kdsDisplayName: string;
  color: string;
  daySchedulesByGroup: ChannelGroupSchedules;
} & VisDraft;

function parseIds(csv: string | undefined): number[] {
  if (!csv?.trim()) return [];
  return csv.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
}

function serializeIds(ids: Set<number> | number[]): string {
  return [...ids].join(',');
}

function getCategoryNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'Category name cannot contain spaces only';
  if (trimmed.length === 0) return 'Category name required';
  if (/^\d$/.test(trimmed)) return null;
  if (trimmed.length < 2 || trimmed.length > 40) return 'Category name must be between 2-40 characters';
  return null;
}

function getPosNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'POS name cannot contain spaces only';
  if (trimmed.length === 0) return 'POS name required';
  if (trimmed.length < 2 || trimmed.length > 60) return 'POS name must be between 2-60 characters';
  return null;
}

function getKdsNameError(value: string): string | null {
  const trimmed = value.trim();
  if (value.length > 0 && trimmed.length === 0) return 'KDS name cannot contain spaces only';
  if (trimmed.length === 0) return 'KDS name required';
  if (trimmed.length < 2 || trimmed.length > 40) return 'KDS name must be between 2-40 characters';
  return null;
}

function buildAvailabilitySummary(draft: Draft): string {
  const channels = VISIBILITY_CHANNELS
    .filter(({ key }) => draft[key as VisibilityChannelKey])
    .map(({ label }) => label);
  const parts: string[] = [];
  if (channels.length === VISIBILITY_CHANNELS.length) parts.push('All channels');
  else if (channels.length === 0) parts.push('Hidden');
  else parts.push(channels.join(', '));
  parts.push(buildGroupSchedulesSummary(draft.daySchedulesByGroup));
  return parts.join('  ·  ');
}

interface Props {
  category: Category;
}

export function CategoryDetailPanel({ category }: Props) {
  const {
    menus,
    tags,
    items,
    modifiers,
    modifierGroups,
    categoryModifiers,
    categoryModifierGroups,
    categoryItems,
    updateCategory,
    addTag,
    updateTag,
    deleteTag,
    getNextId,
    addCategoryModifier,
    removeCategoryModifier,
    applyCategoryModifiersToOptInItems,
    applyCategoryModifiersToAllItems,
    addCategoryModifierGroup,
    removeCategoryModifierGroup,
  } = useMenuStore();

  const validTags = tags.filter((t) => t.id > 0 && t.name.trim().length > 0);

  const [draft, setDraft] = useState<Draft>(() => ({
    categoryName: category.categoryName,
    posDisplayName: category.posDisplayName,
    kdsDisplayName: category.kdsDisplayName,
    color: category.color || DEFAULT_CATEGORY_COLOR,
    visibilityPos: category.visibilityPos ?? true,
    visibilityKiosk: category.visibilityKiosk ?? true,
    visibilityMenuBoard: category.visibilityMenuBoard ?? true,
    visibilityQr: category.visibilityQr ?? true,
    visibilityWebsite: category.visibilityWebsite ?? true,
    visibilityMobileApp: category.visibilityMobileApp ?? true,
    visibilityDoordash: category.visibilityDoordash ?? true,
    daySchedulesByGroup: parseGroupSchedules(category.daySchedulesByGroup, category.daySchedules),
  }));

  const [tagIds, setTagIds] = useState<Set<number>>(() => new Set(parseIds(category.tagIds)));
  const [menuIds, setMenuIds] = useState<Set<number>>(() => new Set(parseIds(category.menuIds)));

  const [touched, setTouched] = useState({ categoryName: false, posDisplayName: false, kdsDisplayName: false });

  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<number | null>(null);

  const [openGroup, setOpenGroup] = useState<'onPrem' | 'offPrem' | null>(null);
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
  const [modifierDropdownOpen, setModifierDropdownOpen] = useState(false);
  const [modifierSearch, setModifierSearch] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const applyFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modifierDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setGroupDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [groupDropdownOpen]);

  useEffect(() => {
    if (!modifierDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modifierDropdownRef.current && !modifierDropdownRef.current.contains(e.target as Node)) {
        setModifierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [modifierDropdownOpen]);

  useEffect(() => {
    setDraft({
      categoryName: category.categoryName,
      posDisplayName: category.posDisplayName,
      kdsDisplayName: category.kdsDisplayName,
      color: category.color || DEFAULT_CATEGORY_COLOR,
      visibilityPos: category.visibilityPos ?? true,
      visibilityKiosk: category.visibilityKiosk ?? true,
      visibilityMenuBoard: category.visibilityMenuBoard ?? true,
      visibilityQr: category.visibilityQr ?? true,
      visibilityWebsite: category.visibilityWebsite ?? true,
      visibilityMobileApp: category.visibilityMobileApp ?? true,
      visibilityDoordash: category.visibilityDoordash ?? true,
      daySchedulesByGroup: parseGroupSchedules(category.daySchedulesByGroup, category.daySchedules),
    });
    setTagIds(new Set(parseIds(category.tagIds)));
    setMenuIds(new Set(parseIds(category.menuIds)));
    setShowTagInput(false);
    setNewTagName('');
    setPendingDeleteTagId(null);
    setOpenGroup(null);
    setExpandedDay(null);
    setBulkStart('');
    setBulkEnd('');
    setModifierDropdownOpen(false);
    setModifierSearch('');
    setGroupDropdownOpen(false);
    setGroupSearch('');
    setApplyFeedback(null);
    setTouched({ categoryName: false, posDisplayName: false, kdsDisplayName: false });
  }, [category.id]);

  const isDirty =
    draft.categoryName !== category.categoryName ||
    draft.posDisplayName !== category.posDisplayName ||
    draft.kdsDisplayName !== category.kdsDisplayName ||
    draft.color !== (category.color || DEFAULT_CATEGORY_COLOR) ||
    draft.visibilityPos !== (category.visibilityPos ?? true) ||
    draft.visibilityKiosk !== (category.visibilityKiosk ?? true) ||
    draft.visibilityMenuBoard !== (category.visibilityMenuBoard ?? true) ||
    draft.visibilityQr !== (category.visibilityQr ?? true) ||
    draft.visibilityWebsite !== (category.visibilityWebsite ?? true) ||
    draft.visibilityMobileApp !== (category.visibilityMobileApp ?? true) ||
    draft.visibilityDoordash !== (category.visibilityDoordash ?? true) ||
    serializeGroupSchedules(draft.daySchedulesByGroup) !== (category.daySchedulesByGroup || serializeGroupSchedules(defaultGroupSchedules())) ||
    serializeIds(tagIds) !== serializeIds(new Set(parseIds(category.tagIds))) ||
    serializeIds(menuIds) !== serializeIds(new Set(parseIds(category.menuIds)));

  const categoryNameError = getCategoryNameError(draft.categoryName);
  const posNameError = getPosNameError(draft.posDisplayName);
  const kdsNameError = getKdsNameError(draft.kdsDisplayName);
  const isFormValid = !categoryNameError && !posNameError && !kdsNameError;

  const handleSave = () => {
    updateCategory(category.id, {
      ...draft,
      daySchedulesByGroup: serializeGroupSchedules(draft.daySchedulesByGroup),
      tagIds: serializeIds(tagIds),
      menuIds: serializeIds(menuIds),
    });
  };

  const handleDiscard = () => {
    setDraft({
      categoryName: category.categoryName,
      posDisplayName: category.posDisplayName,
      kdsDisplayName: category.kdsDisplayName,
      color: category.color || DEFAULT_CATEGORY_COLOR,
      visibilityPos: category.visibilityPos ?? true,
      visibilityKiosk: category.visibilityKiosk ?? true,
      visibilityMenuBoard: category.visibilityMenuBoard ?? true,
      visibilityQr: category.visibilityQr ?? true,
      visibilityWebsite: category.visibilityWebsite ?? true,
      visibilityMobileApp: category.visibilityMobileApp ?? true,
      visibilityDoordash: category.visibilityDoordash ?? true,
      daySchedulesByGroup: parseGroupSchedules(category.daySchedulesByGroup, category.daySchedules),
    });
    setTagIds(new Set(parseIds(category.tagIds)));
    setMenuIds(new Set(parseIds(category.menuIds)));
    setOpenGroup(null);
    setExpandedDay(null);
    setBulkStart('');
    setBulkEnd('');
    setTouched({ categoryName: false, posDisplayName: false, kdsDisplayName: false });
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    const id = getNextId('tags');
    addTag({ id, name });
    setTagIds((prev) => new Set([...prev, id]));
    setNewTagName('');
    setShowTagInput(false);
  };

  const assignedCatMods = categoryModifiers
    .filter((cm) => cm.categoryId === category.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const assignedModifierIds = new Set(assignedCatMods.map((cm) => cm.modifierId));

  const availableModifiers = modifiers.filter(
    (m) => !assignedModifierIds.has(m.id) &&
      (!modifierSearch || m.modifierName.toLowerCase().includes(modifierSearch.toLowerCase()))
  );

  const itemsInCategory = categoryItems.filter((ci) => ci.categoryId === category.id);
  const optInCount = itemsInCategory.filter((ci) => {
    const item = items.find((it) => it.id === ci.itemId);
    return item?.inheritModifiersFromCategory === true;
  }).length;

  const assignedCatGroups = categoryModifierGroups
    .filter((cmg) => cmg.categoryId === category.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const assignedGroupIds = new Set(assignedCatGroups.map((cmg) => cmg.modifierGroupId));
  const availableGroups = modifierGroups.filter(
    (g) => !assignedGroupIds.has(g.id) &&
      (!groupSearch || g.groupName.toLowerCase().includes(groupSearch.toLowerCase())),
  );

  const showApplyFeedback = (msg: string) => {
    if (applyFeedbackTimer.current) clearTimeout(applyFeedbackTimer.current);
    setApplyFeedback(msg);
    applyFeedbackTimer.current = setTimeout(() => setApplyFeedback(null), 2500);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {isDirty && (
        <div className="px-4 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-medium shrink-0">
          Unsaved changes
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 py-3 space-y-4">

          {/* Names — compact inline-label rows */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Names</p>
            <div className="space-y-1">
              <div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-muted-foreground shrink-0 w-[3.5rem]">Name</span>
                  <input
                    className="input-field h-8 text-sm font-semibold flex-1 min-w-0 py-1"
                    value={draft.categoryName}
                    onChange={(e) => setDraft((d) => ({ ...d, categoryName: e.target.value, posDisplayName: e.target.value }))}
                    onBlur={() => {
                      setDraft((d) => ({ ...d, categoryName: d.categoryName.trim(), posDisplayName: d.posDisplayName.trim() }));
                      setTouched((t) => ({ ...t, categoryName: true }));
                    }}
                    placeholder="Category name"
                  />
                </div>
                {touched.categoryName && categoryNameError && (
                  <p className="text-[10px] text-destructive mt-0.5 ml-[4rem]">{categoryNameError}</p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-muted-foreground shrink-0 w-[3.5rem]">POS</span>
                  <input
                    className="input-field h-7 text-xs flex-1 min-w-0 py-1"
                    value={draft.posDisplayName}
                    onChange={(e) => setDraft((d) => ({ ...d, posDisplayName: e.target.value }))}
                    onBlur={() => {
                      setDraft((d) => ({ ...d, posDisplayName: d.posDisplayName.trim() }));
                      setTouched((t) => ({ ...t, posDisplayName: true }));
                    }}
                    placeholder="POS display name"
                  />
                </div>
                {touched.posDisplayName && posNameError && (
                  <p className="text-[10px] text-destructive mt-0.5 ml-[4rem]">{posNameError}</p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-muted-foreground shrink-0 w-[3.5rem]">KDS</span>
                  <input
                    className="input-field h-7 text-xs flex-1 min-w-0 py-1"
                    value={draft.kdsDisplayName}
                    onChange={(e) => setDraft((d) => ({ ...d, kdsDisplayName: e.target.value }))}
                    onBlur={() => {
                      setDraft((d) => ({ ...d, kdsDisplayName: d.kdsDisplayName.trim() }));
                      setTouched((t) => ({ ...t, kdsDisplayName: true }));
                    }}
                    placeholder="KDS display name"
                  />
                </div>
                {touched.kdsDisplayName && kdsNameError && (
                  <p className="text-[10px] text-destructive mt-0.5 ml-[4rem]">{kdsNameError}</p>
                )}
              </div>
            </div>
          </section>

          {/* Color — inline with label */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Color</p>
            <div className="flex items-center gap-3">
              <ColorPalettePicker
                palette={CATEGORY_COLOR_PALETTE}
                value={draft.color}
                onChange={(color) => setDraft((d) => ({ ...d, color }))}
                title="Category color"
              />
              <span className="text-xs text-muted-foreground font-mono">{draft.color}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ background: draft.color }}
              >
                Preview
              </span>
            </div>
          </section>

          {/* Availability — channels + per-group schedule */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Availability</p>
            <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{buildAvailabilitySummary(draft)}</p>

            {/* Channel dropdowns — schedule editor lives inside each expanded group */}
            {(() => {
              const GROUPS = [
                { id: 'onPrem' as const, label: 'On-Prem' as VisibilityGroup, channels: [
                  { key: 'visibilityPos' as VisibilityChannelKey, label: 'POS' },
                  { key: 'visibilityKiosk' as VisibilityChannelKey, label: 'Kiosk' },
                  { key: 'visibilityMenuBoard' as VisibilityChannelKey, label: 'Menu Board' },
                ]},
                { id: 'offPrem' as const, label: 'Off-Prem' as VisibilityGroup, channels: [
                  { key: 'visibilityQr' as VisibilityChannelKey, label: 'QR Code' },
                  { key: 'visibilityWebsite' as VisibilityChannelKey, label: 'Website' },
                  { key: 'visibilityMobileApp' as VisibilityChannelKey, label: 'Mobile App' },
                  { key: 'visibilityDoordash' as VisibilityChannelKey, label: 'DoorDash' },
                ]},
              ];
              return (
                <div className="space-y-1.5">
                  {GROUPS.map((group) => {
                    const isOpen = openGroup === group.id;
                    const active = group.channels.filter((c) => draft[c.key]);
                    const triggerLabel = active.length === 0 ? 'None' : active.length === group.channels.length ? 'All' : active.map((c) => c.label).join(', ');
                    const groupKey = group.label;
                    const groupSched = draft.daySchedulesByGroup[groupKey];
                    return (
                      <div key={group.id}>
                        <button
                          type="button"
                          onClick={() => { const next = isOpen ? null : group.id; setOpenGroup(next); setExpandedDay(null); setBulkStart(''); setBulkEnd(''); }}
                          className={cn('w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors', isOpen ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50')}
                        >
                          <span className="font-medium text-foreground">{group.label}</span>
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className={cn(active.length > 0 && active.length < group.channels.length && 'text-primary')}>{triggerLabel}</span>
                            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="mt-0.5 rounded-md border border-border overflow-hidden">
                            <div className="divide-y divide-border">
                              {group.channels.map(({ key, label }) => {
                                const checked = draft[key];
                                return (
                                  <label key={key} className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                                    <span className={cn('text-xs', checked ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                                    <input type="checkbox" checked={checked} onChange={() => setDraft((d) => ({ ...d, [key]: !d[key] }))} className="accent-primary cursor-pointer" />
                                  </label>
                                );
                              })}
                            </div>
                            <div className="border-t border-border px-3 py-2 space-y-2 bg-muted/20">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Hours (all days)</p>
                                  {(bulkStart || bulkEnd) && <button type="button" className="text-[10px] text-muted-foreground hover:underline" onClick={() => { setBulkStart(''); setBulkEnd(''); }}>Clear</button>}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">From</span>
                                  <input type="time" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} className="input-field h-7 text-xs flex-1 min-w-0" />
                                  <span className="text-[10px] text-muted-foreground">To</span>
                                  <input type="time" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} className="input-field h-7 text-xs flex-1 min-w-0" />
                                  <button type="button" disabled={!bulkStart && !bulkEnd}
                                    onClick={() => { setDraft((prev) => { const next = { ...prev.daySchedulesByGroup[groupKey] }; for (const d of DAYS) { if (next[d].enabled) next[d] = { ...next[d], start: bulkStart, end: bulkEnd }; } return { ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: next } }; }); }}
                                    className="text-[10px] px-2 py-1 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap">Apply</button>
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Days</p>
                                  <button type="button" className="text-[10px] text-primary hover:underline"
                                    onClick={() => { const allEnabled = DAYS.every((d) => groupSched[d].enabled); setDraft((prev) => { const next = { ...prev.daySchedulesByGroup[groupKey] }; for (const d of DAYS) next[d] = { ...next[d], enabled: !allEnabled }; return { ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: next } }; }); }}>
                                    {DAYS.every((d) => groupSched[d].enabled) ? 'All days' : 'Select all'}
                                  </button>
                                </div>
                                <div className="flex gap-1 flex-wrap">
                                  {DAYS.map((day) => {
                                    const sched = groupSched[day];
                                    const isExpanded = expandedDay === day;
                                    const hasTime = sched.start || sched.end;
                                    return (
                                      <button key={day} type="button"
                                        onClick={() => { if (!sched.enabled) { setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [day]: { ...sched, enabled: true } } } })); setExpandedDay(day); } else if (isExpanded) { setExpandedDay(null); } else { setExpandedDay(day); } }}
                                        className={cn('px-2 py-1 rounded text-[11px] font-medium transition-colors border min-w-[30px] text-center', sched.enabled ? (isExpanded ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30' : 'bg-primary text-primary-foreground border-primary') : 'bg-muted/50 text-muted-foreground border-border')}>
                                        {day.slice(0, 1)}{sched.enabled && hasTime ? '·' : ''}
                                      </button>
                                    );
                                  })}
                                </div>
                                {expandedDay && groupSched[expandedDay].enabled && (
                                  <div className="mt-2 p-2.5 rounded-md border border-border bg-muted/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-medium">{expandedDay} hours</p>
                                      <div className="flex gap-2">
                                        {(groupSched[expandedDay].start || groupSched[expandedDay].end) && (
                                          <button type="button" className="text-[10px] text-muted-foreground hover:underline"
                                            onClick={() => setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { ...prev.daySchedulesByGroup[groupKey][expandedDay], start: '', end: '' } } } }))}>Clear</button>
                                        )}
                                        <button type="button" className="text-[10px] text-destructive hover:underline"
                                          onClick={() => { setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { enabled: false, start: '', end: '' } } } })); setExpandedDay(null); }}>Disable</button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-muted-foreground">From</span>
                                      <input type="time" value={groupSched[expandedDay].start}
                                        onChange={(e) => setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { ...prev.daySchedulesByGroup[groupKey][expandedDay], start: e.target.value } } } }))}
                                        className="input-field h-7 text-xs flex-1 min-w-0" />
                                      <span className="text-[10px] text-muted-foreground">To</span>
                                      <input type="time" value={groupSched[expandedDay].end}
                                        onChange={(e) => setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { ...prev.daySchedulesByGroup[groupKey][expandedDay], end: e.target.value } } } }))}
                                        className="input-field h-7 text-xs flex-1 min-w-0" />
                                    </div>
                                    {!groupSched[expandedDay].start && !groupSched[expandedDay].end && <p className="text-[10px] text-muted-foreground">All hours (no restriction)</p>}
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
              );
            })()}
          </section>

          {/* Tags */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Tags ({[...tagIds].filter((id) => validTags.some((t) => t.id === id)).length}/{validTags.length})
            </p>
            <div className="space-y-1.5">
              {validTags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tags exist yet.</p>
              ) : (
                <TooltipProvider delayDuration={900}>
                  <div className="flex flex-wrap gap-1.5">
                    {validTags.map((tag) => {
                      const isAssigned = tagIds.has(tag.id);
                      const isPendingDelete = pendingDeleteTagId === tag.id;
                      const TagIcon = resolveTagIcon(tag.icon);

                      if (isPendingDelete) {
                        return (
                          <span key={tag.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-destructive/10 border-destructive/40 text-destructive">
                            <span>Delete "{tag.name}"?</span>
                            <button type="button" onClick={() => { deleteTag(tag.id); setTagIds((s) => { const n = new Set(s); n.delete(tag.id); return n; }); setPendingDeleteTagId(null); }} className="font-bold hover:opacity-70"><Check className="w-3 h-3" /></button>
                            <button type="button" onClick={() => setPendingDeleteTagId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
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
                                  onClick={() => setTagIds((s) => { const n = new Set(s); isAssigned ? n.delete(tag.id) : n.add(tag.id); return n; })}
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
                          onClick={() => setTagIds((s) => { const n = new Set(s); isAssigned ? n.delete(tag.id) : n.add(tag.id); return n; })}
                          className={cn(
                            'group inline-flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer select-none transition-colors',
                            isAssigned ? 'bg-muted border-primary/40 text-foreground' : 'bg-muted/40 border-border text-muted-foreground hover:border-primary/30',
                          )}
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
                            <button type="button" onClick={(e) => { e.stopPropagation(); setPendingDeleteTagId(tag.id); }} className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
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
                <div className="flex items-center gap-2">
                  <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') { setShowTagInput(false); setNewTagName(''); } }} placeholder="Tag name..." className="input-field h-7 flex-1 text-xs" autoFocus />
                  <button type="button" onClick={handleCreateTag} className="text-xs px-2 py-1 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors whitespace-nowrap">Add</button>
                  <button type="button" onClick={() => { setShowTagInput(false); setNewTagName(''); }} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowTagInput(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="w-3 h-3" /> New tag
                </button>
              )}
            </div>
          </section>

          {/* Category Modifiers */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Modifiers ({assignedCatMods.length})
            </p>
            <div className="space-y-2">
              {/* Assigned modifier chips */}
              {assignedCatMods.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assignedCatMods.map((cm) => {
                    const mod = modifiers.find((m) => m.id === cm.modifierId);
                    if (!mod) return null;
                    return (
                      <span
                        key={cm.modifierId}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-muted border-border text-foreground"
                      >
                        {mod.modifierName}
                        <button
                          type="button"
                          onClick={() => removeCategoryModifier(category.id, cm.modifierId)}
                          className="text-muted-foreground hover:text-destructive ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Add modifier dropdown */}
              <div className="relative" ref={modifierDropdownRef}>
                <button
                  type="button"
                  onClick={() => { setModifierDropdownOpen((o) => !o); setModifierSearch(''); }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
                    modifierDropdownOpen ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50'
                  )}
                >
                  <span className="text-muted-foreground">Add modifier…</span>
                  <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', modifierDropdownOpen && 'rotate-90')} />
                </button>
                {modifierDropdownOpen && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-md border border-border bg-background shadow-md">
                    <div className="p-1.5 border-b border-border">
                      <input
                        type="text"
                        value={modifierSearch}
                        onChange={(e) => setModifierSearch(e.target.value)}
                        placeholder="Search modifiers…"
                        className="input-field h-7 text-xs w-full"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {availableModifiers.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {modifierSearch ? 'No matches' : 'All modifiers assigned'}
                        </p>
                      ) : (
                        availableModifiers.map((mod) => (
                          <button
                            key={mod.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                            onClick={() => {
                              addCategoryModifier(category.id, mod.id);
                              setModifierDropdownOpen(false);
                              setModifierSearch('');
                            }}
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

              {/* Bulk apply buttons */}
              {assignedCatMods.length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  {applyFeedback && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">{applyFeedback}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      applyCategoryModifiersToOptInItems(category.id);
                      showApplyFeedback(`Applied to ${optInCount} opted-in item${optInCount !== 1 ? 's' : ''}`);
                    }}
                    disabled={optInCount === 0}
                    className="w-full px-3 py-1.5 rounded-md border border-border text-xs text-foreground bg-muted/30 hover:bg-muted/50 transition-colors text-left disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Apply to opted-in items
                    <span className="text-muted-foreground ml-1">({optInCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyCategoryModifiersToAllItems(category.id);
                      showApplyFeedback(`Applied to all ${itemsInCategory.length} item${itemsInCategory.length !== 1 ? 's' : ''}`);
                    }}
                    disabled={itemsInCategory.length === 0}
                    className="w-full px-3 py-1.5 rounded-md border border-primary/30 text-xs text-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Force apply to all items
                    <span className="text-muted-foreground ml-1 text-[10px]">— sets inherit flag on all</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Category Modifier Groups */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Modifier Groups ({assignedCatGroups.length})
            </p>
            <div className="space-y-2">
              {/* Assigned group chips */}
              {assignedCatGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assignedCatGroups.map((cmg) => {
                    const grp = modifierGroups.find((g) => g.id === cmg.modifierGroupId);
                    if (!grp) return null;
                    return (
                      <span
                        key={cmg.modifierGroupId}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-primary/5 border-primary/20 text-foreground"
                      >
                        {grp.groupName}
                        <button
                          type="button"
                          onClick={() => removeCategoryModifierGroup(category.id, cmg.modifierGroupId)}
                          className="text-muted-foreground hover:text-destructive ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Add group dropdown */}
              <div className="relative" ref={groupDropdownRef}>
                <button
                  type="button"
                  onClick={() => { setGroupDropdownOpen((o) => !o); setGroupSearch(''); }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
                    groupDropdownOpen ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50',
                  )}
                >
                  <span className="text-muted-foreground">Add modifier group…</span>
                  <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', groupDropdownOpen && 'rotate-90')} />
                </button>
                {groupDropdownOpen && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-md border border-border bg-background shadow-md">
                    <div className="p-1.5 border-b border-border">
                      <input
                        type="text"
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        placeholder="Search groups…"
                        className="input-field h-7 text-xs w-full"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {availableGroups.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {groupSearch ? 'No matches' : modifierGroups.length === 0 ? 'No groups yet — create them in the Modifier Library' : 'All groups assigned'}
                        </p>
                      ) : (
                        availableGroups.map((grp) => (
                          <button
                            key={grp.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                            onClick={() => {
                              addCategoryModifierGroup(category.id, grp.id);
                              setGroupDropdownOpen(false);
                              setGroupSearch('');
                            }}
                          >
                            <span>{grp.groupName}</span>
                            <span className="text-muted-foreground/60 text-[10px]">
                              {grp.modifierIds ? grp.modifierIds.split(',').filter(Boolean).length : 0} mods
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Expand group modifiers into category */}
              {assignedCatGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    assignedCatGroups.forEach((cmg) => {
                      const grp = modifierGroups.find((g) => g.id === cmg.modifierGroupId);
                      if (!grp?.modifierIds) return;
                      grp.modifierIds.split(',').forEach((idStr) => {
                        const modId = parseInt(idStr.trim(), 10);
                        if (!isNaN(modId) && modId > 0) addCategoryModifier(category.id, modId);
                      });
                    });
                    showApplyFeedback('Group modifiers added to category');
                  }}
                  className="w-full px-3 py-1.5 rounded-md border border-border text-xs text-foreground bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  Expand groups → add to category modifiers
                </button>
              )}
            </div>
          </section>

          {/* Menus */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Menus</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {menus.map((menu) => {
                const assigned = menuIds.has(menu.id);
                return (
                  <label key={menu.id} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assigned}
                      onChange={() => {
                        setMenuIds((s) => {
                          const n = new Set(s);
                          assigned ? n.delete(menu.id) : n.add(menu.id);
                          return n;
                        });
                      }}
                      className="accent-primary cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">{menu.menuName}</span>
                  </label>
                );
              })}
              {menus.length === 0 && <p className="text-xs text-muted-foreground">No menus available</p>}
            </div>
          </section>
        </div>
      </div>

      {/* Save / Discard */}
      <div className="shrink-0 px-4 py-3 border-t border-border flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || !isFormValid}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors',
            isDirty && isFormValid
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={!isDirty}
          className="flex-1 py-2 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
