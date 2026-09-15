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

## UI language (AIO design system)

Source of truth is the **`aio-design-system` skill** (`~/.claude/skills/aio-design-system/`),
reverse-engineered from `AIOApp/zeus` -> `apps/portal/web-dash` and verified against its source.
`references/tokens.css` holds every value; `CHECKLIST.md` is the pre-ship pass. When this file and
the skill disagree, the skill is right.

The values live in two layers in `src/index.css`:

1. **`--aio-*`** - the skill's hexes at raw values. Tailwind exposes the useful ones as colours:
   `surface`/`surface-2`/`surface-3`, `rule`/`rule-2`, `ink`/`ink-2`/`ink-muted`/`ink-faint`,
   `accent2`, and `ok`/`warn`/`danger` each with `-bg` and `-edge`, plus `shadow-sm|md|lg|pop`,
   `ease-aio`, `rounded-btn|chip|pill`.
2. **shadcn tokens** (`--background`, `--primary`, ...) - the same hexes converted to HSL triples, so
   existing components inherit the language without being touched.

The rules that are easiest to break:

- **Surface ladder**: `#F3F5F7` canvas -> `#FFFFFF` card -> `#F6F6F6` recessed tile. Never put a
  white tile on a grey card - that inversion is the most recognisable AIO trait.
- **Flat, not floating.** Depth is a 1px `#ECECF5` border. Shadows are only for things that genuinely
  float: dropdowns, popovers, modals, toasts. Cards get no shadow.
- **One brand colour.** Coral `#F9674E`, used as a tint (`#FFDFD7` selected, `#FEE4DE` hover,
  `#FFE5E0` emphasis) far more than as a fill. No second accent, no gradients. `--aio-accent-2` is
  the chart palette's categorical indigo, for telling two tags apart - not a brand colour.
- **Destructive is coral**, not red. `#D5381D` is validation feedback only, never a button fill.
- **Sentence case everywhere.** No uppercase, no letter-spaced labels. `-0.02em` tracking on
  everything >=16px, `0` below.
- **Weight 500 is the default UI weight.** 600 for titles, 700 for display only.
- **Radii come off the scale**: 4 / 8 / 9 (nav pill) / 10 (buttons) / 12 (cards, dialogs) / 16
  (chips) / 20 / 999. Never invent one.
- **Motion** is 150/200/250ms on `cubic-bezier(.4,0,.2,1)`. No decorative animation.

Deliberate deviations:

- **Layout, density and IA are this app's own** and were explicitly excluded from the conformance
  pass - the 60px icon rail, 13px type, compact rows and the multi-column builder stay. The skill
  describes a 283px labelled sidebar and 60px table rows for six dashboard archetypes; the menu
  builder is not one of them.
- **Icons are `lucide-react`**; the skill calls for `@mui/icons-material` `*Outlined` or Material
  Symbols. Swapping the library is a separate job.
- **Dark mode is this app's own near-black**, not the skill's navy (`#091121` / `#132037`). The
  skill's source app renders light-only with no toggle and no reference screenshots, so there is
  nothing to be consistent with; a blue-cast near-black (`#0d0d12` / `#16161d` / `#1e1e27`) is what
  the product wants. Everything that isn't a surface hue still follows the skill in dark: one coral
  accent, coral washes for selection rather than navy tints, flat elevation, its radius and motion
  scales. Status colours are marked `(inferred)` in `index.css` — the skill defines none for dark.
- **`ghost` buttons stay neutral** - in this codebase that variant is the icon affordance, not the
  skill's coral `tertiary`.
- Two skill-prescribed bug fixes are applied: a real `--aio-accent-h` (`#E04A30`) so the primary
  hover does something, and a visible `:focus-visible` ring.
- POS and kiosk previews keep their own `--pos-*` tokens - they mirror the POS device, not the
  console.
