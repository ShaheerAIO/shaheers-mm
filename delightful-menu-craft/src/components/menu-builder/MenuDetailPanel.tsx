import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
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
import type { Menu } from '@/types/menu';

type VisDraft = Pick<Menu,
  'visibilityPos' | 'visibilityKiosk' | 'visibilityQr' |
  'visibilityWebsite' | 'visibilityMobileApp' | 'visibilityDoordash'
>;

type Draft = {
  menuName: string;
  posDisplayName: string;
  posButtonColor: string;
  daySchedulesByGroup: ChannelGroupSchedules;
} & VisDraft;

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
  menu: Menu;
}

const ON_PREM: { key: VisibilityChannelKey; label: string }[] = [
  { key: 'visibilityPos', label: 'POS' },
  { key: 'visibilityKiosk', label: 'Kiosk' },
  { key: 'visibilityMenuBoard', label: 'Menu Board' },
];
const OFF_PREM: { key: VisibilityChannelKey; label: string }[] = [
  { key: 'visibilityQr', label: 'QR Code' },
  { key: 'visibilityWebsite', label: 'Website' },
  { key: 'visibilityMobileApp', label: 'Mobile App' },
  { key: 'visibilityDoordash', label: 'DoorDash' },
];
const CHANNEL_GROUPS = [
  { id: 'onPrem' as const, label: 'On-Prem', channels: ON_PREM },
  { id: 'offPrem' as const, label: 'Off-Prem', channels: OFF_PREM },
];

export function MenuDetailPanel({ menu }: Props) {
  const { updateMenu } = useMenuStore();

  const [draft, setDraft] = useState<Draft>(() => ({
    menuName: menu.menuName,
    posDisplayName: menu.posDisplayName,
    posButtonColor: menu.posButtonColor || '#f97316',
    visibilityPos: menu.visibilityPos ?? true,
    visibilityKiosk: menu.visibilityKiosk ?? true,
    visibilityQr: menu.visibilityQr ?? true,
    visibilityWebsite: menu.visibilityWebsite ?? true,
    visibilityMobileApp: menu.visibilityMobileApp ?? true,
    visibilityDoordash: menu.visibilityDoordash ?? true,
    daySchedulesByGroup: parseGroupSchedules(menu.daySchedulesByGroup, menu.daySchedules),
  }));

  const [openGroup, setOpenGroup] = useState<'onPrem' | 'offPrem' | null>(null);
  const [expandedDay, setExpandedDay] = useState<DayKey | null>(null);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');

  useEffect(() => {
    setDraft({
      menuName: menu.menuName,
      posDisplayName: menu.posDisplayName,
      posButtonColor: menu.posButtonColor || '#f97316',
      visibilityPos: menu.visibilityPos ?? true,
      visibilityKiosk: menu.visibilityKiosk ?? true,
      visibilityQr: menu.visibilityQr ?? true,
      visibilityWebsite: menu.visibilityWebsite ?? true,
      visibilityMobileApp: menu.visibilityMobileApp ?? true,
      visibilityDoordash: menu.visibilityDoordash ?? true,
      daySchedulesByGroup: parseGroupSchedules(menu.daySchedulesByGroup, menu.daySchedules),
    });
    setOpenGroup(null);
    setExpandedDay(null);
    setBulkStart('');
    setBulkEnd('');
  }, [menu.id]);

  const isDirty =
    draft.menuName !== menu.menuName ||
    draft.posDisplayName !== menu.posDisplayName ||
    draft.posButtonColor !== (menu.posButtonColor || '#f97316') ||
    draft.visibilityPos !== (menu.visibilityPos ?? true) ||
    draft.visibilityKiosk !== (menu.visibilityKiosk ?? true) ||
    draft.visibilityQr !== (menu.visibilityQr ?? true) ||
    draft.visibilityWebsite !== (menu.visibilityWebsite ?? true) ||
    draft.visibilityMobileApp !== (menu.visibilityMobileApp ?? true) ||
    draft.visibilityDoordash !== (menu.visibilityDoordash ?? true) ||
    serializeGroupSchedules(draft.daySchedulesByGroup) !== (menu.daySchedulesByGroup || serializeGroupSchedules(defaultGroupSchedules()));

  const handleSave = () => {
    updateMenu(menu.id, {
      ...draft,
      daySchedulesByGroup: serializeGroupSchedules(draft.daySchedulesByGroup),
    });
  };

  const handleDiscard = () => {
    setDraft({
      menuName: menu.menuName,
      posDisplayName: menu.posDisplayName,
      posButtonColor: menu.posButtonColor || '#f97316',
      visibilityPos: menu.visibilityPos ?? true,
      visibilityKiosk: menu.visibilityKiosk ?? true,
      visibilityQr: menu.visibilityQr ?? true,
      visibilityWebsite: menu.visibilityWebsite ?? true,
      visibilityMobileApp: menu.visibilityMobileApp ?? true,
      visibilityDoordash: menu.visibilityDoordash ?? true,
      daySchedulesByGroup: parseGroupSchedules(menu.daySchedulesByGroup, menu.daySchedules),
    });
    setOpenGroup(null);
    setExpandedDay(null);
    setBulkStart('');
    setBulkEnd('');
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

          {/* Names */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Names</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-muted-foreground shrink-0 w-[3.5rem]">Name</span>
                <input
                  className="input-field h-8 text-sm font-semibold flex-1 min-w-0 py-1"
                  value={draft.menuName}
                  onChange={(e) => setDraft((d) => ({ ...d, menuName: e.target.value, posDisplayName: e.target.value }))}
                  placeholder="Menu name"
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
            </div>
          </section>

          {/* Button color */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">POS Button Color</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={draft.posButtonColor}
                onChange={(e) => setDraft((d) => ({ ...d, posButtonColor: e.target.value }))}
                className="h-8 w-12 rounded cursor-pointer border border-border p-0.5 bg-transparent"
              />
              <span className="text-xs text-muted-foreground font-mono">{draft.posButtonColor}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ background: draft.posButtonColor }}
              >
                Preview
              </span>
            </div>
          </section>

          {/* Availability */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Availability</p>
            <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{buildAvailabilitySummary(draft)}</p>

            {/* Channel dropdowns — schedule editor lives inside each expanded group */}
            <div className="space-y-1.5">
              {CHANNEL_GROUPS.map((group) => {
                const isOpen = openGroup === group.id;
                const active = group.channels.filter((c) => draft[c.key]);
                const triggerLabel =
                  active.length === 0 ? 'None' :
                  active.length === group.channels.length ? 'All' :
                  active.map((c) => c.label).join(', ');
                const groupKey = group.label as VisibilityGroup;
                const groupSched = draft.daySchedulesByGroup[groupKey];
                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = isOpen ? null : group.id;
                        setOpenGroup(next);
                        setExpandedDay(null);
                        setBulkStart('');
                        setBulkEnd('');
                      }}
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
                      <div className="mt-0.5 rounded-md border border-border overflow-hidden">
                        {/* Channel checkboxes */}
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

                        {/* Schedule for this group */}
                        <div className="border-t border-border px-3 py-2 space-y-2 bg-muted/20">
                          {/* Bulk hours */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Hours (all days)</p>
                              {(bulkStart || bulkEnd) && (
                                <button type="button" className="text-[10px] text-muted-foreground hover:underline" onClick={() => { setBulkStart(''); setBulkEnd(''); }}>Clear</button>
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
                                    const next = { ...prev.daySchedulesByGroup[groupKey] };
                                    for (const d of DAYS) {
                                      if (next[d].enabled) next[d] = { ...next[d], start: bulkStart, end: bulkEnd };
                                    }
                                    return { ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: next } };
                                  });
                                }}
                                className="text-[10px] px-2 py-1 rounded border border-primary/40 text-primary bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                              >Apply</button>
                            </div>
                          </div>

                          {/* Day toggles */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Days</p>
                              <button
                                type="button"
                                className="text-[10px] text-primary hover:underline"
                                onClick={() => {
                                  const allEnabled = DAYS.every((d) => groupSched[d].enabled);
                                  setDraft((prev) => {
                                    const next = { ...prev.daySchedulesByGroup[groupKey] };
                                    for (const d of DAYS) next[d] = { ...next[d], enabled: !allEnabled };
                                    return { ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: next } };
                                  });
                                }}
                              >
                                {DAYS.every((d) => groupSched[d].enabled) ? 'All days' : 'Select all'}
                              </button>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {DAYS.map((day) => {
                                const sched = groupSched[day];
                                const isExpanded = expandedDay === day;
                                const hasTime = sched.start || sched.end;
                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                      if (!sched.enabled) {
                                        setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [day]: { ...sched, enabled: true } } } }));
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
                                        ? isExpanded ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30' : 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-muted/50 text-muted-foreground border-border',
                                    )}
                                  >
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
                                        onClick={() => setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { ...prev.daySchedulesByGroup[groupKey][expandedDay], start: '', end: '' } } } }))}>
                                        Clear
                                      </button>
                                    )}
                                    <button type="button" className="text-[10px] text-destructive hover:underline"
                                      onClick={() => {
                                        setDraft((prev) => ({ ...prev, daySchedulesByGroup: { ...prev.daySchedulesByGroup, [groupKey]: { ...prev.daySchedulesByGroup[groupKey], [expandedDay]: { enabled: false, start: '', end: '' } } } }));
                                        setExpandedDay(null);
                                      }}>
                                      Disable
                                    </button>
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
                                {!groupSched[expandedDay].start && !groupSched[expandedDay].end && (
                                  <p className="text-[10px] text-muted-foreground">All hours (no restriction)</p>
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
