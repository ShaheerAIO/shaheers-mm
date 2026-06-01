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
