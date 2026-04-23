import { useState, useEffect } from 'react';
import { Check, X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';
import {
  parseDaySchedules,
  serializeDaySchedules,
  buildDaysSummary,
  defaultDaySchedules,
  VISIBILITY_CHANNELS,
  DAYS,
  type DayScheduleMap,
  type DayKey,
  type VisibilityChannelKey,
} from '@/lib/visibility';
import type { Category } from '@/types/menu';

type VisDraft = Pick<Category,
  'visibilityPos' | 'visibilityKiosk' | 'visibilityQr' |
  'visibilityWebsite' | 'visibilityMobileApp' | 'visibilityDoordash'
>;

type Draft = {
  categoryName: string;
  posDisplayName: string;
  kdsDisplayName: string;
  color: string;
  daySchedules: DayScheduleMap;
} & VisDraft;

function parseIds(csv: string | undefined): number[] {
  if (!csv?.trim()) return [];
  return csv.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
}

function serializeIds(ids: Set<number> | number[]): string {
  return [...ids].join(',');
}

function buildAvailabilitySummary(draft: Draft): string {
  const channels = VISIBILITY_CHANNELS
    .filter(({ key }) => draft[key as VisibilityChannelKey])
    .map(({ label }) => label);
  const parts: string[] = [];
  if (channels.length === VISIBILITY_CHANNELS.length) parts.push('All channels');
  else if (channels.length === 0) parts.push('Hidden');
  else parts.push(channels.join(', '));
  parts.push(buildDaysSummary(draft.daySchedules));
  return parts.join('  ·  ');
}

interface Props {
  category: Category;
}

export function CategoryDetailPanel({ category }: Props) {
  const {
    menus,
    tags,
    updateCategory,
    addTag,
    deleteTag,
    getNextId,
  } = useMenuStore();

  const validTags = tags.filter((t) => t.id > 0 && t.name.trim().length > 0);

  const [draft, setDraft] = useState<Draft>(() => ({
    categoryName: category.categoryName,
    posDisplayName: category.posDisplayName,
    kdsDisplayName: category.kdsDisplayName,
    color: category.color || '#f97316',
    visibilityPos: category.visibilityPos ?? true,
    visibilityKiosk: category.visibilityKiosk ?? true,
    visibilityQr: category.visibilityQr ?? true,
    visibilityWebsite: category.visibilityWebsite ?? true,
    visibilityMobileApp: category.visibilityMobileApp ?? true,
    visibilityDoordash: category.visibilityDoordash ?? true,
    daySchedules: parseDaySchedules(category.daySchedules),
  }));

  const [tagIds, setTagIds] = useState<Set<number>>(() => new Set(parseIds(category.tagIds)));
  const [menuIds, setMenuIds] = useState<Set<number>>(() => new Set(parseIds(category.menuIds)));

  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<number | null>(null);

  const [openGroup, setOpenGroup] = useState<'onPrem' | 'offPrem' | null>(null);
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');

  useEffect(() => {
    setDraft({
      categoryName: category.categoryName,
      posDisplayName: category.posDisplayName,
      kdsDisplayName: category.kdsDisplayName,
      color: category.color || '#f97316',
      visibilityPos: category.visibilityPos ?? true,
      visibilityKiosk: category.visibilityKiosk ?? true,
      visibilityQr: category.visibilityQr ?? true,
      visibilityWebsite: category.visibilityWebsite ?? true,
      visibilityMobileApp: category.visibilityMobileApp ?? true,
      visibilityDoordash: category.visibilityDoordash ?? true,
      daySchedules: parseDaySchedules(category.daySchedules),
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
  }, [category.id]);

  const isDirty =
    draft.categoryName !== category.categoryName ||
    draft.posDisplayName !== category.posDisplayName ||
    draft.kdsDisplayName !== category.kdsDisplayName ||
    draft.color !== (category.color || '#f97316') ||
    draft.visibilityPos !== (category.visibilityPos ?? true) ||
    draft.visibilityKiosk !== (category.visibilityKiosk ?? true) ||
    draft.visibilityQr !== (category.visibilityQr ?? true) ||
    draft.visibilityWebsite !== (category.visibilityWebsite ?? true) ||
    draft.visibilityMobileApp !== (category.visibilityMobileApp ?? true) ||
    draft.visibilityDoordash !== (category.visibilityDoordash ?? true) ||
    serializeDaySchedules(draft.daySchedules) !== (category.daySchedules || serializeDaySchedules(defaultDaySchedules())) ||
    serializeIds(tagIds) !== serializeIds(new Set(parseIds(category.tagIds))) ||
    serializeIds(menuIds) !== serializeIds(new Set(parseIds(category.menuIds)));

  const handleSave = () => {
    updateCategory(category.id, {
      ...draft,
      daySchedules: serializeDaySchedules(draft.daySchedules),
      tagIds: serializeIds(tagIds),
      menuIds: serializeIds(menuIds),
    });
  };

  const handleDiscard = () => {
    setDraft({
      categoryName: category.categoryName,
      posDisplayName: category.posDisplayName,
      kdsDisplayName: category.kdsDisplayName,
      color: category.color || '#f97316',
      visibilityPos: category.visibilityPos ?? true,
      visibilityKiosk: category.visibilityKiosk ?? true,
      visibilityQr: category.visibilityQr ?? true,
      visibilityWebsite: category.visibilityWebsite ?? true,
      visibilityMobileApp: category.visibilityMobileApp ?? true,
      visibilityDoordash: category.visibilityDoordash ?? true,
      daySchedules: parseDaySchedules(category.daySchedules),
    });
    setTagIds(new Set(parseIds(category.tagIds)));
    setMenuIds(new Set(parseIds(category.menuIds)));
    setOpenGroup(null);
    setExpandedDay(null);
    setBulkStart('');
    setBulkEnd('');
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
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-muted-foreground shrink-0 w-[3.5rem]">Name</span>
                <input
                  className="input-field h-8 text-sm font-semibold flex-1 min-w-0 py-1"
                  value={draft.categoryName}
                  onChange={(e) => setDraft((d) => ({ ...d, categoryName: e.target.value, posDisplayName: e.target.value }))}
                  placeholder="Category name"
                />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-muted-foreground shrink-0 w-[3.5rem]">POS</span>
                <input
                  className="input-field h-7 text-xs flex-1 min-w-0 py-1"
                  value={draft.posDisplayName}
                  onChange={(e) => setDraft((d) => ({ ...d, posDisplayName: e.target.value }))}
                  placeholder="POS display name"
                />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-muted-foreground shrink-0 w-[3.5rem]">KDS</span>
                <input
                  className="input-field h-7 text-xs flex-1 min-w-0 py-1"
                  value={draft.kdsDisplayName}
                  onChange={(e) => setDraft((d) => ({ ...d, kdsDisplayName: e.target.value }))}
                  placeholder="KDS display name"
                />
              </div>
            </div>
          </section>

          {/* Color — inline with label */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Color</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                className="h-8 w-12 rounded cursor-pointer border border-border p-0.5 bg-transparent"
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

          {/* Availability — channels + schedule */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Availability</p>
            <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{buildAvailabilitySummary(draft)}</p>

            {/* Channels — two dropdowns: On-Prem and Off-Prem */}
            {(() => {
              const GROUPS = [
                {
                  id: 'onPrem' as const,
                  label: 'On-Prem',
                  channels: [
                    { key: 'visibilityPos' as VisibilityChannelKey, label: 'POS' },
                    { key: 'visibilityKiosk' as VisibilityChannelKey, label: 'Kiosk' },
                  ],
                },
                {
                  id: 'offPrem' as const,
                  label: 'Off-Prem',
                  channels: [
                    { key: 'visibilityQr' as VisibilityChannelKey, label: 'QR Code' },
                    { key: 'visibilityWebsite' as VisibilityChannelKey, label: 'Website' },
                    { key: 'visibilityMobileApp' as VisibilityChannelKey, label: 'Mobile App' },
                    { key: 'visibilityDoordash' as VisibilityChannelKey, label: 'DoorDash' },
                  ],
                },
              ];
              return (
                <div className="space-y-1.5 mb-3">
                  {GROUPS.map((group) => {
                    const isOpen = openGroup === group.id;
                    const active = group.channels.filter((c) => draft[c.key]);
                    const triggerLabel =
                      active.length === 0 ? 'None' :
                      active.length === group.channels.length ? 'All' :
                      active.map((c) => c.label).join(', ');
                    return (
                      <div key={group.id}>
                        <button
                          type="button"
                          onClick={() => setOpenGroup(isOpen ? null : group.id)}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-colors',
                            isOpen ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50',
                          )}
                        >
                          <span className="font-medium text-foreground">{group.label}</span>
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className={cn(active.length > 0 && active.length < group.channels.length && 'text-primary')}>
                              {triggerLabel}
                            </span>
                            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
                          </span>
                        </button>
                        {isOpen && (
                          <div className="mt-0.5 rounded-md border border-border divide-y divide-border overflow-hidden">
                            {group.channels.map(({ key, label }) => {
                              const checked = draft[key];
                              return (
                                <label
                                  key={key}
                                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                                >
                                  <span className={cn('text-xs', checked ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setDraft((d) => ({ ...d, [key]: !d[key] }))}
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
              );
            })()}

            {/* Bulk hours */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Hours (all days)</p>
                {(bulkStart || bulkEnd) && (
                  <button type="button" className="text-[10px] text-muted-foreground hover:underline" onClick={() => { setBulkStart(''); setBulkEnd(''); }}>
                    Clear
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">From</span>
                <input type="time" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} className="input-field h-7 text-xs flex-1 min-w-0" />
                <span className="text-[10px] text-muted-foreground">To</span>
                <input type="time" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} className="input-field h-7 text-xs flex-1 min-w-0" />
                <button
                  type="button"
                  disabled={!bulkStart && !bulkEnd}
                  onClick={() => {
                    setDraft((prev) => {
                      const next = { ...prev.daySchedules };
                      for (const d of DAYS) {
                        if (next[d].enabled) next[d] = { ...next[d], start: bulkStart, end: bulkEnd };
                      }
                      return { ...prev, daySchedules: next };
                    });
                  }}
                  className="text-[10px] px-2 py-1 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Per-day toggles */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Days</p>
                <button
                  type="button"
                  className="text-[10px] text-primary hover:underline"
                  onClick={() => {
                    const allEnabled = DAYS.every((d) => draft.daySchedules[d].enabled);
                    setDraft((prev) => {
                      const next = { ...prev.daySchedules };
                      for (const d of DAYS) next[d] = { ...next[d], enabled: !allEnabled };
                      return { ...prev, daySchedules: next };
                    });
                  }}
                >
                  {DAYS.every((d) => draft.daySchedules[d].enabled) ? 'All days' : 'Select all'}
                </button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {DAYS.map((day) => {
                  const sched = draft.daySchedules[day];
                  const isExpanded = expandedDay === day;
                  const hasTime = sched.start || sched.end;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        if (!sched.enabled) {
                          setDraft((prev) => ({ ...prev, daySchedules: { ...prev.daySchedules, [day]: { ...sched, enabled: true } } }));
                          setExpandedDay(day);
                        } else if (isExpanded) {
                          setExpandedDay(null);
                        } else {
                          setExpandedDay(day);
                        }
                      }}
                      className={cn(
                        'px-2 py-1 rounded text-[11px] font-medium transition-colors border min-w-[30px] text-center',
                        sched.enabled
                          ? isExpanded
                            ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
                            : 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 text-muted-foreground border-border',
                      )}
                    >
                      {day.slice(0, 1)}{sched.enabled && hasTime ? '·' : ''}
                    </button>
                  );
                })}
              </div>

              {expandedDay && draft.daySchedules[expandedDay].enabled && (
                <div className="mt-2 p-2.5 rounded-md border border-border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{expandedDay} hours</p>
                    <div className="flex gap-2">
                      {(draft.daySchedules[expandedDay].start || draft.daySchedules[expandedDay].end) && (
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground hover:underline"
                          onClick={() => setDraft((prev) => ({
                            ...prev,
                            daySchedules: { ...prev.daySchedules, [expandedDay]: { ...prev.daySchedules[expandedDay], start: '', end: '' } },
                          }))}
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-[10px] text-destructive hover:underline"
                        onClick={() => {
                          setDraft((prev) => ({
                            ...prev,
                            daySchedules: { ...prev.daySchedules, [expandedDay]: { enabled: false, start: '', end: '' } },
                          }));
                          setExpandedDay(null);
                        }}
                      >
                        Disable
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">From</span>
                    <input
                      type="time"
                      value={draft.daySchedules[expandedDay].start}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        daySchedules: { ...prev.daySchedules, [expandedDay]: { ...prev.daySchedules[expandedDay], start: e.target.value } },
                      }))}
                      className="input-field h-7 text-xs flex-1 min-w-0"
                    />
                    <span className="text-[10px] text-muted-foreground">To</span>
                    <input
                      type="time"
                      value={draft.daySchedules[expandedDay].end}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        daySchedules: { ...prev.daySchedules, [expandedDay]: { ...prev.daySchedules[expandedDay], end: e.target.value } },
                      }))}
                      className="input-field h-7 text-xs flex-1 min-w-0"
                    />
                  </div>
                  {!draft.daySchedules[expandedDay].start && !draft.daySchedules[expandedDay].end && (
                    <p className="text-[10px] text-muted-foreground">All hours (no restriction)</p>
                  )}
                </div>
              )}
            </div>
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
                <div className="flex flex-wrap gap-1.5">
                  {validTags.map((tag) => {
                    const isAssigned = tagIds.has(tag.id);
                    const isPendingDelete = pendingDeleteTagId === tag.id;
                    if (isPendingDelete) {
                      return (
                        <span key={tag.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border bg-destructive/10 border-destructive/40 text-destructive">
                          <span>Delete "{tag.name}"?</span>
                          <button type="button" onClick={() => { deleteTag(tag.id); setTagIds((s) => { const n = new Set(s); n.delete(tag.id); return n; }); setPendingDeleteTagId(null); }} className="font-bold hover:opacity-70"><Check className="w-3 h-3" /></button>
                          <button type="button" onClick={() => setPendingDeleteTagId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
                        </span>
                      );
                    }
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
                        <button type="button" onClick={(e) => { e.stopPropagation(); setPendingDeleteTagId(tag.id); }} className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
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
          disabled={!isDirty}
          className={cn(
            'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors',
            isDirty
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
