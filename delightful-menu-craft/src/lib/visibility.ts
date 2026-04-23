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
  { key: 'visibilityPos',        label: 'POS',        group: 'In-Store' },
  { key: 'visibilityKiosk',      label: 'Kiosk',      group: 'In-Store' },
  { key: 'visibilityQr',         label: 'QR Code',    group: 'Online'   },
  { key: 'visibilityWebsite',    label: 'Website',    group: 'Online'   },
  { key: 'visibilityMobileApp',  label: 'Mobile App', group: 'Online'   },
  { key: 'visibilityDoordash',   label: 'DoorDash',   group: 'Online'   },
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
  qr: 'visibilityQr',
  qrcode: 'visibilityQr',
  website: 'visibilityWebsite',
  mobileapp: 'visibilityMobileApp',
  mobile: 'visibilityMobileApp',
  doordash: 'visibilityDoordash',
  doordash3p: 'visibilityDoordash',
  // Legacy aliases
  online: 'visibilityQr', // old "Online" maps to QR as the closest match
};

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
          visibilityQr:         false,
          visibilityWebsite:    false,
          visibilityMobileApp:  false,
          visibilityDoordash:   false,
        };
        let recognizedCount = 0;
        for (const platform of arr) {
          const key = PLATFORM_TO_KEY[normalizePlatformName(platform)];
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
    visibilityQr:         parseBool(row['visibilityQr'],        legacyOnline),
    visibilityWebsite:    parseBool(row['visibilityWebsite'],   legacyOnline),
    visibilityMobileApp:  parseBool(row['visibilityMobileApp'], legacyOnline),
    visibilityDoordash:   parseBool(row['visibilityDoordash'],  legacyThirdParty),
  };
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
  // legacy names still accepted
  visibilityOnline?: boolean;
  visibilityThirdParty?: boolean;
}): Record<VisibilityChannelKey, boolean> {
  const online = item.visibilityOnline ?? true;
  const thirdParty = item.visibilityThirdParty ?? true;
  return {
    visibilityPos:        item.visibilityPos        ?? true,
    visibilityKiosk:      item.visibilityKiosk      ?? true,
    visibilityQr:         item.visibilityQr         ?? online,
    visibilityWebsite:    item.visibilityWebsite     ?? online,
    visibilityMobileApp:  item.visibilityMobileApp  ?? online,
    visibilityDoordash:   item.visibilityDoordash   ?? thirdParty,
  };
}
