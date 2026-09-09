# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build (also used to type-check — clean output means no TS errors)
npm run lint       # ESLint
npm run preview    # Preview production build
```

There is no test suite. Use `npm run build` to verify TypeScript correctness.

## What this app is

A restaurant POS menu management tool. Operators build menus (menus → categories → items), configure modifiers/options, set per-channel visibility and day/time availability, manage kitchen stations, and import/export everything via Excel. There is also a Claude-powered AI enhancement flow for station assignment and name generation.

## State: Zustand + localStorage

All app state lives in a single Zustand store at `src/store/menuStore.ts`, persisted to `localStorage` under the key `menu-manager-storage`. The store has a version counter (currently v8) with explicit migration functions — bump the version and add a migration whenever a schema change requires backfilling existing data.

**UI state** (active tab, selected/editing IDs, creation modes, view mode) and **data state** (menus, categories, items, modifiers, modifier options, tags, allergens, stations, join tables) are both in the same store.

## Data model

All types live in `src/types/menu.ts` and mirror a multi-sheet Excel workbook:

| Entity | Key relationships |
|---|---|
| `Menu` | top-level; has visibility + daySchedules |
| `Category` | belongs to a Menu; can have a `parentCategoryId` for nesting |
| `Item` | belongs to a Category; has price, stock, station, visibility, daySchedules |
| `Modifier` / `ModifierOption` | linked to Items via `ItemModifier` join; modifiers can nest other modifiers |
| `Station` | numeric ID + optional label; Items reference stationId |
| `Tag`, `Allergen` | linked to Items via join tables |

## Visibility & scheduling

`src/lib/visibility.ts` is the single source of truth for channel definitions. All 6 channels and their group membership are defined in `VISIBILITY_CHANNELS` — UI labels, groupings, and parse helpers all derive from it. When adding or renaming a channel, edit only this file.

Channels are grouped into **On-Prem** (POS, Kiosk) and **Off-Prem** (QR Code, Website, Mobile App, DoorDash). `VisibilityGroup = 'On-Prem' | 'Off-Prem'`.

Day/time availability is stored per channel-group as `daySchedulesByGroup` — a JSON-encoded `ChannelGroupSchedules` (`Record<VisibilityGroup, DayScheduleMap>`). Each group has its own independent schedule so On-Prem and Off-Prem can have different hours. Use `parseGroupSchedules(raw, fallbackSingle?)` to read (falls back to copying the legacy `daySchedules` string to both groups) and `serializeGroupSchedules()` to write. The old `daySchedules` field is preserved on the entity for backward compat but is not authoritative. The v8 store migration backfills `daySchedulesByGroup` from `daySchedules` for all existing entities.

## Excel import / export

- **Import**: `src/lib/excelParser.ts` → `importData()` in the store
- **Export**: `exportData()` in the store → `src/lib/excelExporter.ts`

The parser handles two visibility formats: a unified JSON array column (`visibility: '["Pos","Kiosk"]'`) and individual boolean columns (`visibilityPos: true`). Legacy column names (`visibilityOnline`, `visibilityThirdParty`) are mapped to canonical keys in `PLATFORM_TO_KEY`.

## UI layout

```
<Index>
  <LeftSidebar>      60 px icon nav — switches activeTab
  <MainContent>      routes by activeTab to one of 5 content areas
  <RightSidebar>     320 px detail/edit panels (menu-builder tab only)
```

The right sidebar renders one panel at a time based on store flags: `editingMenuId`, `editingCategoryId`, `selectedItemId`, `isCreatingModifier`, `isCreatingOption`.

The **menu-builder** tab is the primary editing surface: `MenuBuilderContent` → `CategoryColumns` (two-column category + item lists) or `POSPreview` (QSR/TSR preview modes).

## Dropdown pattern for channel visibility + scheduling

All channel-visibility sections use the same collapsible dropdown UI pattern: a trigger button showing "All / None / comma list", chevron toggle, expanding to channel checkboxes. In entity detail panels (Menu, Category, Item) the schedule editor (bulk hours setter + per-day toggles + expanded-day time picker) is embedded inside each group's expanded panel so On-Prem and Off-Prem get independent schedules. See `MenuDetailPanel.tsx` availability section for the canonical reference. `ItemDetailPanel`, `CreateModifierPanel`, and `ModifierLibraryContent` all follow the same pattern using `getChannelsByGroup()`.

## AI enhancement

`src/lib/aiEnhance.ts` calls Claude Haiku with a compact payload (item names + existing station map). The hook `src/hooks/useAiEnhance.ts` manages the load → review → accept/reject → apply state machine. The review UI is in `AiEnhanceModal.tsx`. Patches are applied via `applyAiPatches()` in the store.

## UI language (AIO console)

The app's visual language is ported from the AIO MDM console (`udm.aioapp.com`). It lives in two
layers, both in `src/index.css`:

1. **`--aio-*`** — the AIO tokens at their raw values (surface tiers, rules, status washes, brand
   gradient, shadows, motion, radii). Use these for anything the shadcn slots don't cover. Tailwind
   exposes the useful ones as colours: `surface`/`surface-2`/`surface-3`, `rule`/`rule-2`,
   `ink`/`ink-2`/`ink-muted`/`ink-faint`, `accent2`, and `ok`/`warn`/`danger` each with `-bg` and
   `-edge` variants, plus `shadow-sm|md|lg|pop`, `bg-brand`, `ease-aio`, `rounded-pill`.
2. **shadcn tokens** (`--background`, `--primary`, …) — HSL triples remapped onto the AIO palette, so
   existing components inherit the language without being touched.

Conventions carried over from the console:

- **Accent is coral, not orange**: `#f9674e` light / `#f9805f` dark, with `--aio-accent-2` (indigo)
  as the second accent. The wordmark gradient is `.brand-aio`.
- **Semantic modifiers, not raw palette classes.** Status is `ok` / `warn` / `danger` / `info` with a
  matching `-bg` wash and `-edge` border — never `text-green-600` or `bg-amber-500/10`. The only
  exceptions are the POS and kiosk preview components, which deliberately mirror the POS device UI
  (purple shell, orange tiles) and keep their own `--pos-*` tokens.
- **Reds are washed, not filled.** `Button variant="destructive"` is a `danger-bg` chip with a
  `danger-edge`; filled red is reserved for dialog confirmations.
- **Type**: Poppins (self-hosted via `@fontsource`, imported in `src/main.tsx`), JetBrains Mono for
  IDs and build names. 13px is the body size; metrics get `.tnum` (tabular figures).
- **Radius 12px** (`--radius`), 8px for controls, 24px for cards, pill for chips/badges.
- **Narrative headers**: `.aio-eyebrow` (uppercase accent label) + `.aio-h1` (a sentence, with the
  number or subject in `<b>` and accent-coloured) + `.aio-sub`. Copy reads as sentences, not labels.
- **Empty states are first-class**: a tinted circular icon, a bold line, then one plain-language line
  saying what to do next.
- **Motion**: 140ms on `--aio-ease`; buttons take a 1px press.
- Dark mode is a full second token set, not a filter. The theme toggle lives in the appbar (`TopBar`).
