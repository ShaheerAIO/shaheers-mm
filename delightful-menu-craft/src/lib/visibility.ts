/**
 * Canonical visibility schema.
 *
 * All channel definitions, day-schedule types, parse helpers, and runtime
 * checks live here.  UI editors, parsers, exporters, and preview consumers
 * all import from this module so adding/renaming a channel or day-schedule
 * field requires a single-file edit.
 */

import type { Item, Modifier, ModifierOption } from '@/types/menu';

// ---------------------------------------------------------------------------
// Channel definitions
// ---------------------------------------------------------------------------

export const VISIBILITY_CHANNELS = [
  { key: 'visibilityPos',        label: 'POS',        group: 'On-Prem',  token: 'Pos'       },
  { key: 'visibilityKiosk',      label: 'Kiosk',      group: 'On-Prem',  token: 'Kiosk'     },
  { key: 'visibilityMenuBoard',  label: 'Menu Board', group: 'On-Prem',  token: 'MenuBoard' },
  { key: 'visibilityQr',         label: 'QR Code',    group: 'Off-Prem', token: 'QR'        },
  { key: 'visibilityWebsite',    label: 'Website',    group: 'Off-Prem', token: 'Website'  },
  { key: 'visibilityMobileApp',  label: 'Mobile App', group: 'Off-Prem', token: 'Mpos'     },
  { key: 'visibilityDoordash',   label: 'DoorDash',   group: 'Off-Prem', token: 'Doordash' },
] as const;

export type VisibilityChannelKey = typeof VISIBILITY_CHANNELS[number]['key'];
export type VisibilityGroup = typeof VISIBILITY_CHANNELS[number]['group'];

// Channels grouped by their group label (useful for rendering grouped sections)
export function getChannelsByGroup(): Record<VisibilityGroup, typeof VISIBILITY_CHANNELS[number][]> {
  const map: Record<string, typeof VISIBILITY_CHANNELS[number][]> = {};
  for (const ch of VISIBILITY_CHANNELS) {
    (map[ch.group] ??= []).push(ch);
  }
  return map as Record<VisibilityGroup, typeof VISIBILITY_CHANNELS[number][]>;
}

// ---------------------------------------------------------------------------
// Day-schedule types
// ---------------------------------------------------------------------------

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DAYS: readonly DayKey[] = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
];

export interface DaySchedule {
  enabled: boolean;
  start: string; // "HH:MM" or "" (no restriction)
  end: string;   // "HH:MM" or "" (no restriction)
}

export type DayScheduleMap = Record<DayKey, DaySchedule>;

// ---------------------------------------------------------------------------
// Runtime helpers — visibility
// ---------------------------------------------------------------------------

type VisibilityItem = Pick<Item | Modifier | ModifierOption, VisibilityChannelKey>;

/**
 * Returns true when the entity is visible on the given channel.
 * Defaults to true when the field is missing (backward-compat with legacy data).
 */
export function isVisibleOnChannel(
  item: VisibilityItem,
  channel: VisibilityChannelKey,
): boolean {
  return (item as Record<string, unknown>)[channel] as boolean ?? true;
}

/**
 * Default visibility for a newly-created entity — all channels enabled.
 */
export function defaultVisibility(): Record<VisibilityChannelKey, boolean> {
  return {
    visibilityPos:        true,
    visibilityKiosk:      true,
    visibilityMenuBoard:  true,
    visibilityQr:         true,
    visibilityWebsite:    true,
    visibilityMobileApp:  true,
    visibilityDoordash:   true,
  };
}

// ---------------------------------------------------------------------------
// Runtime helpers — day schedules
// ---------------------------------------------------------------------------

/** Default schedule: all 7 days enabled, no time restriction. */
export function defaultDaySchedules(): DayScheduleMap {
  const map = {} as DayScheduleMap;
  for (const day of DAYS) {
    map[day] = { enabled: true, start: '', end: '' };
  }
  return map;
}

/**
 * Parse a DayScheduleMap from stored JSON string.
 * Accepts three fallback signatures:
 *   1. `raw` is a valid JSON-encoded DayScheduleMap → use it directly
 *   2. Legacy `availableDays` / `availableTimeStart` / `availableTimeEnd` strings
 *      → build the map from them (all active days share the same time pair)
 *   3. Nothing provided → all days enabled, no restriction
 */
export function parseDaySchedules(
  raw: string | undefined | null,
  legacyDays?: string | undefined,
  legacyStart?: string | undefined,
  legacyEnd?: string | undefined,
): DayScheduleMap {
  // 1. Try the new JSON field first
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Partial<DayScheduleMap>;
      if (typeof parsed === 'object' && parsed !== null) {
        const result = defaultDaySchedules();
        for (const day of DAYS) {
          const entry = parsed[day];
          if (entry && typeof entry === 'object') {
            result[day] = {
              enabled: typeof entry.enabled === 'boolean' ? entry.enabled : true,
              start: typeof entry.start === 'string' ? entry.start : '',
              end: typeof entry.end === 'string' ? entry.end : '',
            };
          }
        }
        return result;
      }
    } catch {
      // fall through
    }
  }

  // 2. Migrate from legacy comma-separated availableDays + single time pair
  const result = defaultDaySchedules();
  const start = legacyStart?.trim() ?? '';
  const end   = legacyEnd?.trim()   ?? '';

  if (legacyDays && legacyDays.trim()) {
    const activeDays = new Set(
      legacyDays.split(',').map((d) => d.trim()).filter(Boolean),
    );
    for (const day of DAYS) {
      result[day] = {
        enabled: activeDays.has(day),
        start: activeDays.has(day) ? start : '',
        end:   activeDays.has(day) ? end   : '',
      };
    }
  } else {
    // Empty availableDays = all days available
    for (const day of DAYS) {
      result[day] = { enabled: true, start, end };
    }
  }

  return result;
}

/** Serialize a DayScheduleMap to the JSON string stored on the Item. */
export function serializeDaySchedules(map: DayScheduleMap): string {
  return JSON.stringify(map);
}

/**
 * Build a short human-readable summary of the day schedule for display in
 * accordion headers and list previews.
 *
 * Examples:
 *   "All days · All hours"
 *   "Mon, Tue, Wed · 09:00–17:00"
 *   "Mon 09:00–17:00 · Sat 11:00–22:00"  (when days have different hours)
 */
export function buildDaysSummary(map: DayScheduleMap): string {
  const enabled = DAYS.filter((d) => map[d].enabled);
  if (enabled.length === 0) return 'No days';

  // Check whether all enabled days share the same time pair
  const times = enabled.map((d) => `${map[d].start}|${map[d].end}`);
  const allSame = times.every((t) => t === times[0]);

  const timeStr = (s: string, e: string) =>
    s || e ? `${s || '?'}–${e || '?'}` : 'All hours';

  if (allSame) {
    const dayPart = enabled.length === 7 ? 'All days' : enabled.join(', ');
    return `${dayPart} · ${timeStr(map[enabled[0]].start, map[enabled[0]].end)}`;
  }

  // Different hours per day — list each one
  return enabled
    .map((d) => `${d} ${timeStr(map[d].start, map[d].end)}`)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Parse helpers — visibility from Excel rows
// ---------------------------------------------------------------------------

/** Maps normalized platform names to canonical visibility keys. */
const PLATFORM_TO_KEY: Record<string, VisibilityChannelKey> = {
  pos: 'visibilityPos',
  kiosk: 'visibilityKiosk',
  menuboard: 'visibilityMenuBoard',
  mpos: 'visibilityMobileApp', // POS "Mpos" (mobile POS) ≈ our Mobile App
  qr: 'visibilityQr',
  qrcode: 'visibilityQr',
  website: 'visibilityWebsite',
  mobileapp: 'visibilityMobileApp',
  mobile: 'visibilityMobileApp',
  doordash: 'visibilityDoordash',
  doordash3p: 'visibilityDoordash',
  // Legacy / POS aliases
  online: 'visibilityWebsite', // POS "Online" ordering ≈ Website
  // POS-only channels with no app equivalent (nugget, catering)
  // are intentionally not mapped and are ignored on import.
};

/** Channel keys belonging to a visibility group (derived from VISIBILITY_CHANNELS). */
const groupChannelKeys = (group: VisibilityGroup): VisibilityChannelKey[] =>
  VISIBILITY_CHANNELS.filter((c) => c.group === group).map((c) => c.key);

/**
 * Serialize the 6 boolean channel fields into the POS `visibility` JSON column.
 * The POS accepts a JSON array of either group tokens (`["OnPrem","OffPrem"]`)
 * or individual channel tokens (`["Kiosk","QR","Doordash"]`). Per group: when
 * every channel in the group is on we collapse to the group token; when only
 * some are on we list those channels individually; when none are on we emit
 * nothing. Nothing enabled at all → "" (matching empty cells in real POS files).
 */
export function serializeVisibility(
  channels: Partial<Record<VisibilityChannelKey, boolean>>,
): string {
  // A channel counts as on unless explicitly false (missing = visible, matching
  // isVisibleOnChannel), so entities created without visibility fields default
  // to fully visible.
  const on = (k: VisibilityChannelKey) => channels[k] !== false;
  const tokens: string[] = [];
  for (const group of ['On-Prem', 'Off-Prem'] as VisibilityGroup[]) {
    const keys = groupChannelKeys(group);
    const onKeys = keys.filter(on);
    if (onKeys.length === 0) continue;
    if (onKeys.length === keys.length) {
      tokens.push(group === 'On-Prem' ? 'OnPrem' : 'OffPrem');
    } else {
      for (const c of VISIBILITY_CHANNELS) if (c.group === group && on(c.key)) tokens.push(c.token);
    }
  }
  return tokens.length ? JSON.stringify(tokens) : '';
}

const normalizePlatformName = (value: unknown): string =>
  String(value).trim().toLowerCase().replace(/[\s_-]+/g, '');

/**
 * Parse visibility from an Excel row. Supports two input formats:
 *
 *   • Unified JSON array column: `visibility: '["Pos","Kiosk"]'`
 *   • Individual boolean columns: `visibilityPos: true`, etc.
 *
 * Legacy columns `visibilityOnline` and `visibilityThirdParty` are handled:
 *   - `visibilityOnline` → sets visibilityQr, visibilityWebsite, visibilityMobileApp
 *   - `visibilityThirdParty` → sets visibilityDoordash
 */
export function parseVisibilityFromRow(
  row: Record<string, unknown>,
): Record<VisibilityChannelKey, boolean> {
  const raw = row['visibility'];
  if (raw !== undefined && raw !== null && raw !== '') {
    try {
      const arr = JSON.parse(String(raw));
      if (Array.isArray(arr)) {
        if (arr.length === 0) return defaultVisibility();
        const result: Record<VisibilityChannelKey, boolean> = {
          visibilityPos:        false,
          visibilityKiosk:      false,
          visibilityMenuBoard:  false,
          visibilityQr:         false,
          visibilityWebsite:    false,
          visibilityMobileApp:  false,
          visibilityDoordash:   false,
        };
        let recognizedCount = 0;
        for (const platform of arr) {
          const norm = normalizePlatformName(platform);
          // Group tokens expand to every channel in the group.
          if (norm === 'onprem' || norm === 'offprem') {
            const group: VisibilityGroup = norm === 'onprem' ? 'On-Prem' : 'Off-Prem';
            for (const key of groupChannelKeys(group)) {
              result[key] = true;
              recognizedCount += 1;
            }
            continue;
          }
          const key = PLATFORM_TO_KEY[norm];
          if (key) {
            result[key] = true;
            recognizedCount += 1;
          }
        }
        // If the array exists but contains only unknown values, fail open instead
        // of hiding everything in previews.
        return recognizedCount > 0 ? result : defaultVisibility();
      }
    } catch {
      // fall through to column-based parsing
    }
  }

  // Per-column parsing — new columns first, then legacy fallbacks
  const parseBool = (v: unknown, def = true): boolean => {
    if (v === null || v === undefined || v === '') return def;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    if (typeof v === 'number') return v === 1;
    return def;
  };

  // Legacy online / third-party defaults (used when new columns absent)
  const legacyOnline = parseBool(row['visibilityOnline']);
  const legacyThirdParty = parseBool(row['visibilityThirdParty']);

  return {
    visibilityPos:        parseBool(row['visibilityPos']),
    visibilityKiosk:      parseBool(row['visibilityKiosk']),
    visibilityMenuBoard:  parseBool(row['visibilityMenuBoard']),
    visibilityQr:         parseBool(row['visibilityQr'],        legacyOnline),
    visibilityWebsite:    parseBool(row['visibilityWebsite'],   legacyOnline),
    visibilityMobileApp:  parseBool(row['visibilityMobileApp'], legacyOnline),
    visibilityDoordash:   parseBool(row['visibilityDoordash'],  legacyThirdParty),
  };
}

// ---------------------------------------------------------------------------
// Per-channel-group schedules
// ---------------------------------------------------------------------------

/** A schedule map for each visibility group (On-Prem / Off-Prem). */
export type ChannelGroupSchedules = Record<VisibilityGroup, DayScheduleMap>;

/** Both groups start fully enabled with no time restriction. */
export function defaultGroupSchedules(): ChannelGroupSchedules {
  return {
    'On-Prem': defaultDaySchedules(),
    'Off-Prem': defaultDaySchedules(),
  };
}

/**
 * Parse a ChannelGroupSchedules from the `daySchedulesByGroup` JSON string.
 * If that field is absent/invalid, falls back to copying the legacy single
 * `daySchedules` value to both groups so old data migrates transparently.
 */
export function parseGroupSchedules(
  raw: string | undefined | null,
  fallbackSingle?: string | undefined,
): ChannelGroupSchedules {
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed === 'object' && parsed !== null) {
        const onPrem  = parsed['On-Prem'];
        const offPrem = parsed['Off-Prem'];
        if (onPrem !== undefined || offPrem !== undefined) {
          return {
            'On-Prem':  parseDaySchedules(onPrem  !== undefined ? JSON.stringify(onPrem)  : undefined),
            'Off-Prem': parseDaySchedules(offPrem !== undefined ? JSON.stringify(offPrem) : undefined),
          };
        }
      }
    } catch {
      // fall through
    }
  }
  const single = parseDaySchedules(fallbackSingle);
  return { 'On-Prem': single, 'Off-Prem': { ...single } };
}

export function serializeGroupSchedules(map: ChannelGroupSchedules): string {
  return JSON.stringify(map);
}

/**
 * Short summary for accordion headers.
 * Returns one summary when both groups share the same schedule,
 * or "On-Prem: … · Off-Prem: …" when they differ.
 */
export function buildGroupSchedulesSummary(map: ChannelGroupSchedules): string {
  const on  = buildDaysSummary(map['On-Prem']);
  const off = buildDaysSummary(map['Off-Prem']);
  return on === off ? on : `On-Prem: ${on} · Off-Prem: ${off}`;
}

/**
 * Normalize optional boolean visibility fields from the DoorDash scraper
 * payload. The scraper may still send legacy `visibilityOnline` / `visibilityThirdParty`.
 * All fields default to `true` when absent.
 */
export function parseVisibilityFromScraper(item: {
  visibilityPos?: boolean;
  visibilityKiosk?: boolean;
  visibilityQr?: boolean;
  visibilityWebsite?: boolean;
  visibilityMobileApp?: boolean;
  visibilityDoordash?: boolean;
  visibilityMenuBoard?: boolean;
  // legacy names still accepted
  visibilityOnline?: boolean;
  visibilityThirdParty?: boolean;
}): Record<VisibilityChannelKey, boolean> {
  const online = item.visibilityOnline ?? true;
  const thirdParty = item.visibilityThirdParty ?? true;
  return {
    visibilityPos:        item.visibilityPos        ?? true,
    visibilityKiosk:      item.visibilityKiosk      ?? true,
    visibilityMenuBoard:  item.visibilityMenuBoard  ?? true,
    visibilityQr:         item.visibilityQr         ?? online,
    visibilityWebsite:    item.visibilityWebsite     ?? online,
    visibilityMobileApp:  item.visibilityMobileApp  ?? online,
    visibilityDoordash:   item.visibilityDoordash   ?? thirdParty,
  };
}
