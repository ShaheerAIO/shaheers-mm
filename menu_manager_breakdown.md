# Menu Manager — Feedback Breakdown & Implementation Map

> Companion to `menu_manager_dev_brief.md`. This is the *analysis* pass — current state, root cause, fix shape, regression risk, and test cases for every point. **Nothing is implemented yet.** Goal: address all 27 points + technical notes without creating new problems while solving old ones.

Store version is currently **v16** (not v8/v13 — those are stale in older docs). Migrations run on both localStorage hydration and Supabase workspace hydration.

---

## 0. TL;DR — things that change the plan

**Already (partly) built — don't rebuild from scratch:**

| # | Point | What already exists |
|---|---|---|
| 11 | Add-ons / alcohol | `Item.addonIds` + `isSpecialRequest` fields exist (unused in UI); "Contains Alcohol" is already a **system tag** (id 1). Mostly UI wiring, not new schema. |
| 12 | Size pricing | Custom sizes already model as a **size-flagged modifier** (`isSizeModifier`) whose options carry per-size surcharge; round-trips through Excel today. Likely UX, not data model. |
| 14 | Multi-level subcategory | `Category.parentCategoryId` **already nests arbitrarily**; cascade-delete already recursive. Limit is UI-only (renders one level). |
| 16 | Reorder modifier options | **Drag-and-drop already works** in the Modifier Library detail panel (`reorderModifierOptions`). Only the *create* panel lacks it. |
| 20 | Station "Select all" | A full **Select-all/Clear-all modal already exists** (`StationItemsModal` + `bulkSetItemsForStation`) but is **dead code** (never mounted). |
| 22 | Project switching | "Switch project" button + `/workspaces` page **already exist** (`handleSwitchProject`). Likely a discoverability gap, not missing functionality. |
| 26 | Relationship view | The **Bulk tab already is a relationship browser** for *forward* direction (Menu→Cat→Item→Mod→Option). See §4 verdict. |

**No drag-and-drop library is needed** for #16/#18/#19 — the codebase already uses native HTML5 drag events. Match that pattern; do **not** add a dependency.

**Hard dependencies / sequencing (get these right or we create new bugs):**
- **#3 + #4 + #5 are ONE fix.** All three trace to `itemHasPopupModifiers` in `ModifierPanel.tsx` not recursing into nested modifiers, plus TSR having no ticket-line re-open. Scope as a single change with one reconciled rule.
- **#1 blocks #27.** Detail panels hold unsaved edits in local React state and lose them on tab switch. #27 (clickable cross-entity nav) calls `setActiveTab`, which would *silently discard dirty panels*. Fixing #1 (or adding a dirty-guard) is a prerequisite for #27 — otherwise #27 makes data loss worse.
- **#25 ⟷ #12 collide in Excel.** Both touch the overloaded modifier-option `price` ⟷ join `maxLimit` surcharge bridge. Must be designed together.
- **#2 + #24 share** the missing runtime availability evaluator.

**External blockers (need a human decision before coding):**
- **#25** — the brief's "Item 3PO sheet" **does not exist** in our exporter or in either sample workbook. 3PO is three flat columns on the Item sheet today; modifier options have zero 3PO support. The real "Item 3PO" sheet must be coming from the POS schema or Aamir's WIP. **Confirm the exact sheet/column contract with Aamir before building.**
- Coordinate with **Aamir's in-progress Excel export rework** on field ordering before we touch headers (header order is a hard POS contract).

---

## 1. Master table

Legend — Effort: S/M/L. Decision: 🟢 ready to build · 🟡 needs a product/UX decision · 🔴 blocked on external info (Aamir/POS schema).

| # | Title | Type | Effort | Status | Primary files |
|---|---|---|---|---|---|
| 1 | Item details cleared on tab nav | Bug | M | 🟡 autosave-vs-save decision | `Index.tsx`, `ItemDetailPanel.tsx`, (maybe `menuStore.ts`) |
| 2 | Availability not enforced in POS | Bug | M | 🟡 hide-vs-disable + timezone | `visibility.ts`, QSR/TSR/Kiosk panels |
| 3 | Required nested modifiers not enforced | Bug | S | 🟢 | `ModifierPanel.tsx` |
| 4 | Nested modifiers invisible in TSR | Bug | S–M | 🟢 (bundle w/ 3,5) | `ModifierPanel.tsx`, `POSPreview.tsx`, `TSRMenuPanel.tsx` |
| 5 | Item options not selectable in TSR | Bug | S–M | 🟡 open-on-any-modifier rule | `ModifierPanel.tsx`, `POSPreview.tsx`, `TSRMenuPanel.tsx` |
| 6 | Group pricing amount field broken | Bug | M | 🟡 group-price runtime math | `CreateModifierPanel.tsx`, `ModifierLibraryContent.tsx`, `posPricing.ts` |
| 7 | KDS name no auto-populate + Menu Board default | Data entry | S | 🟢 (Menu-level KDS 🟡) | `CategoryDetailPanel.tsx`, `MenuDetailPanel.tsx`, `menuStore.ts` (startFresh seed) |
| 8 | Required ⇒ min default 1 | Data entry | S–M | 🟢 (migration optional) | `ModifierLibraryContent.tsx`, maybe `menuStore.ts` |
| 9 | Min/max not clearly displayed | Data entry | S | 🟢 | `ModifierLibraryContent.tsx`, `CreateModifierPanel.tsx` |
| 10 | Qty fields reject typed input | Data entry | S | 🟢 | `CreateModifierPanel.tsx`, `ModifierLibraryContent.tsx` |
| 11 | Add-ons section + alcohol toggle | Data entry | S–M | 🟡 define "add-on" target | `ItemDetailPanel.tsx` (fields already exist) |
| 12 | Size-based pricing | Feature | S–M | 🟡 reuse size-modifier? | `ItemDetailPanel.tsx`, create panels (no schema change) |
| 13 | Tag icon config unintuitive | Data entry | M–L | 🟡 UX redesign | `TagIconPicker.tsx`, `ItemDetailPanel.tsx`, `CategoryDetailPanel.tsx` |
| 14 | Multi-level subcategory | Feature | M | 🟢 (UI only; confirm POS accepts depth) | `CategoryColumns.tsx`, `CategoryColumn.tsx` |
| 15 | Modifier→item linkage not visible | Modifier mgmt | S–M | 🟢 | `ModifierLibraryContent.tsx` |
| 16 | Modifier options not reorderable (create flow) | Modifier mgmt | S | 🟢 | `CreateModifierPanel.tsx` |
| 17 | Duplicate/copy items & modifiers | Modifier mgmt | M (item) / L (modifier) | 🟡 share-vs-deep-clone | `menuStore.ts`, list/detail UIs |
| 18 | Categories/items not reorderable | Sorting | M | 🟢 | `menuStore.ts` (2 new actions), `CategoryColumns.tsx`, `CategoryColumn.tsx` |
| 19 | Move items between categories | Sorting | M (S if rides on 18) | 🟡 copy-vs-move | `CategoryColumn.tsx`, maybe `menuStore.ts` |
| 20 | "Select all" for stations | UX | S | 🟢 | `StationsContent.tsx` (action + modal exist) |
| 21 | Image upload (menu/cat/item) | UX | L | 🔴 Supabase Storage + POS value format | new bucket, `imageUpload.ts`, 3 detail panels |
| 22 | Project nav / switching | UX | S | 🟡 discoverability vs missing | `TopBar.tsx`, `LeftSidebar.tsx` |
| 23 | Modifier option & pricing overview | UX | M | 🟢 | `ModifierLibraryContent.tsx` (new view) |
| 24 | Kiosk preview ≠ real kiosk | UX | L | 🔴 need real-kiosk spec | `kiosk-preview/*` |
| 25 | 3PO platform pricing | Feature | L | 🔴 confirm "Item 3PO" sheet w/ Aamir | `types/menu.ts`, `menuStore.ts` (v17), `excelExporter.ts`, `excelParser.ts`, UIs |
| 26 | Relationship mapping view | Feature | M (gap only) | 🟡 rescope — see §4 | `BulkColumns.tsx` / new reverse-lookup |
| 27 | Clickable entity navigation | Feature | M–L | 🔴 blocked on #1 | `menuStore.ts` (nav helpers), detail panels, Bulk view |

---

## 2. Dependency / sequencing clusters

**Cluster A — Modifier order-entry (POS/TSR) [#3, #4, #5].** Single root cause: `itemHasPopupModifiers` (`ModifierPanel.tsx:22-33`) only inspects root modifiers, so an item whose required selections live in *nested* modifiers fast-adds with no popup. TSR additionally has no ticket-line re-open path (`POSPreview.tsx:246` is QSR-only). Reconciled rule to confirm: **"open the modifier panel whenever an item has any attached modifier OR any required descendant; enforce completion via the already-recursive `canPressDone`."** Fix once, covers all three. Add a visited-set guard against cyclic `modifierIds`.

**Cluster B — Unsaved edits [#1 → #27].** Panels commit only on Save; tab switch unmounts `RightSidebar` (`Index.tsx:19`) and discards the draft. Tag/allergen edits already write immediately (proof the draft buffer is the culprit). #27's click-through navigation must not ship until this is resolved, or it amplifies data loss.

**Cluster C — Runtime availability [#2, #24].** No "available right now" evaluator exists anywhere. Add pure helpers to `visibility.ts` (`groupForChannel`, `dayKeyForDate`, `isWithinDaySchedule`, `isAvailableOnChannelAt`) and call them in QSR/TSR/Kiosk filters. POS and Kiosk both map to the **On-Prem** group.

**Cluster D — Excel pricing [#25, #12].** Both ride the option `price` ⟷ join `maxLimit` surcharge bridge. Design 3PO option pricing so it does not clobber the size surcharge. Likely a single v17 migration.

**Cluster E — Drag/sort [#16, #18, #19].** Shared native-HTML5-DnD pattern. #19 rides on #18's item-row DnD. New store actions: `reorderCategories`, `reorderCategoryItems`, optional `moveItemToCategory`.

---

## 3. "Don't create new problems" — regression watchlist

- **Blank Excel cells must be ABSENT, never `''`** (POS validator). Any new column/sheet must route through `createSheet` blanking or replicate it. Append new Item columns at the **end** (header order is positional contract) — confirm with Aamir.
- **Items belong to multiple categories** (CategoryItem join, no `Item.categoryId`). #19 "move" must not delete other memberships.
- **Modifier options are a shared library**; #17 duplicate-modifier should share options/nested children by default (deep-clone is a decision).
- **`getItemsForCategory` rolls up subcategory items**; #18 reorder must operate on the correct `categoryId` scope, and #14 recursion must dedupe.
- **Required ⇒ min 1 (#8)**: coercing min could surprise a user who set min 0 deliberately — confirm it's truly invalid in the POS contract before adding a store-level coercion/migration.
- **KDS auto-populate (#7)**: mirror the name only while "linked" (the existing `itemNameDrivesPosKds` pattern) so a manually-edited KDS name isn't clobbered on rename.
- **Group pricing (#6)**: changing `modifierSurchargePerUnit` affects subtotal/tax in both POS and Kiosk previews — don't fork the math.
- **Read-only lock**: drag/reorder/move actions must respect `useIsReadOnly`.
- **Availability enforcement (#2)** makes previews time-dependent (an item visible at noon vanishes at 3pm) — surface the evaluated "now" or a preview override so QA isn't confused.
- **`StationItemsModal` is pre-existing dead code** — flag, don't delete unless we wire it up for #20.

---

## 4. #26 verdict — your "bulk options covers it" instinct

**You're partly right.** The **Bulk tab** (`BulkColumns.tsx`) is already a Miller-column relationship browser covering the **forward** chain: Menu → Categories → Items → Modifiers → Nested Modifiers → Options, traversing all the join tables.

What it covers from #26's table: Menu→Categories ✅, Category→Items ✅, Item→Modifiers ✅, Modifier→Options ✅, Modifier→nested ✅.

**What it does NOT cover (the genuine, non-redundant gap):** the **reverse / many-to-many** directions —
- Category → which **Menus** it belongs to
- Item → which **Categories** contain it
- Modifier → which **Items** use it  *(this overlaps with #15)*
- Option → which **Modifiers** use it

These reverse lookups are exactly where users get lost (items live in many categories; options/modifiers are shared). Also, Bulk is an *edit* tool, not a *navigation map* (that's #27).

**Recommendation:** Don't build a whole new relationship map. **Rescope #26 to "add reverse-relationship visibility"** — and note #15 already asks for the Modifier→Items slice. Push back on the rest as redundant with the Bulk tab, with this evidence.

---

## 5. Open questions to resolve before building (blockers)

1. **#25 (Aamir):** exact "Item 3PO" sheet schema — column names, per-item vs per-platform-row, does the POS read inline Item columns or only the dedicated sheet? Do modifier options get their own 3PO sheet?
2. **#25/#12:** are upcharge/percentage *modes* persisted, or only the resolved absolute price? (Today only absolute survives.)
3. **#1:** autosave-on-change vs explicit Save + dirty-guard? Drives the whole fix approach.
4. **#2:** off-time items — hide entirely or grey-out/disable? And which timezone (browser-local for preview vs a configured restaurant TZ)?
5. **#6:** what does "group price" mean at runtime — one surcharge per group regardless of options chosen?
6. **#11:** what does an "add-on" reference — other items, modifiers, or options? (Reuse `addonIds` if items.)
7. **#12:** is this ergonomics over the existing size-modifier mechanism, or a genuinely new pricing structure? (Strongly prefer reuse.)
8. **#14:** does the POS importer accept >1 level of category nesting?
9. **#17:** share vs deep-clone modifier options/nested children; which categories an item-copy lands in.
10. **#19:** default drag = move or copy?
11. **#21:** which image slots to expose (Item has 5), and what value format the POS expects (URL vs path)?
12. **#22:** discoverability tweak vs a genuinely new nav path?
13. **#24:** need a real-kiosk reference spec (resolution/orientation, top nav, category nav model, item card, modifier-less flow).

---

## 6. Suggested phasing

**Phase 1 — quick, safe, high-value (mostly 🟢, no schema change):**
#9, #10, #16, #20, #7 (Menu Board default + category KDS), #15, #23, #22 (if discoverability).

**Phase 2 — core bug cluster:**
#3+#4+#5 (one change), #6, #2 (after hide-vs-disable decision), #8.

**Phase 3 — state/UX foundations:**
#1 (unblocks #27), #18 (+#19), #11, #12, #14.

**Phase 4 — larger features (need decisions/external info):**
#17, #13, #26 (reverse lookups), #27 (after #1), #25 (after Aamir confirms sheet), #21, #24.

---

## 7. Per-point detail

> Condensed from subsystem investigation. Each cites the load-bearing code location.

### #1 — Item details cleared on tab nav
`ItemDetailPanel` buffers edits in local `draft` state (`:172-243`), commits only on `handleSave` (`:396`). `RightSidebar` mounts only for `menu-builder` tab (`Index.tsx:19`) → tab switch unmounts → draft lost. Tags/allergens write immediately so they survive (the tell). **Fix options:** (A) keep RightSidebar mounted, hide via CSS; (B) autosave per field; (C) hoist draft into a transient store slice (exclude from `WORKSPACE_DATA_KEYS`). No migration. **Test:** edit name+price, tab away, return → edits persist.

### #2 — Availability not enforced
No runtime evaluator; previews filter only on the channel boolean (`QSRMenuPanel.tsx:41,48`, `TSRMenuPanel.tsx:62,78,121`, `KioskMenuScreen.tsx:33,59`). **Fix:** add `isAvailableOnChannelAt(entity, channel, now)` to `visibility.ts` (reads `parseGroupSchedules`, maps `Date`→DayKey, handles empty/overnight windows). POS & Kiosk → On-Prem group. **Tests:** day disabled → hidden; window 9–17 in/out; overnight 22–02; empty window → always on; per-group difference.

### #3/#4/#5 — Modifier panel cluster
`itemHasPopupModifiers` (`ModifierPanel.tsx:27-32`) ignores nested mods → required nested selections unenforced and TSR appears to "lack" modifiers (it shares the same panel). `canPressDone` already recurses correctly. TSR has no re-open path (`POSPreview.tsx:246`). **Fix:** recurse the open-gate using the same child resolution `canPressDone` uses; reconcile to "open if any attached modifier or required descendant." Add cycle guard. **Tests:** optional-root + required-nested opens popup & blocks Done; optional-only opens & is selectable in TSR; zero-modifier item still fast-adds; cyclic ref doesn't hang; QSR↔TSR option parity.

### #6 — Group pricing amount field
Pricing `Select` sets `modifierOptionPriceType='Group'` (`CreateModifierPanel.tsx:786-800`) but no amount input renders; `Modifier.price` (`menu.ts:169`) is unbound. **Fix:** when type=Group, render one amount input bound to `Modifier.price`, gate per-option `$` inputs, and make `posPricing.ts modifierSurchargePerUnit` read the group amount once per group. Mirror in `ModifierLibraryContent.tsx`. **Tests:** Group shows single input, persists; switching back restores per-option without data loss; preview charges group amount once; Excel round-trip.

### #7 — KDS auto-populate + Menu Board default
Category Name onChange writes Name+POS but omits `kdsDisplayName` (`CategoryDetailPanel.tsx:285`). Menu Board is **not** actually off by default in data (`defaultVisibility()` → true) — but `MenuDetailPanel`'s `VisDraft` omits `visibilityMenuBoard` (`:21-24,68-79`) so the checkbox renders unchecked, and `startFresh()`'s seed menu (`menuStore.ts:800-807`) omits all visibility fields. **Fix:** mirror KDS while linked; add `visibilityMenuBoard` to MenuDetailPanel draft/init/dirty/discard; spread `...defaultVisibility()` into the seed menu. Menu-level KDS needs a new field (defer). **Tests:** rename category updates KDS; Menu Board checkbox reflects stored value.

### #8 — Required ⇒ min 1
Create flow auto-sets min 1 (`CreateModifierPanel.tsx:139-144`); **edit** flow does not (`ModifierLibraryContent.tsx:1736-1754`). **Fix:** add the same effect to edit draft; optionally a store-level invariant in `updateModifier`/`bulkUpdateModifiers` + v17 backfill. **Tests:** edit Optional→Required sets min 1; user-set min 2 not clobbered.

### #9 — Min/max display
Buried in collapsed accordion (`CreateModifierPanel.tsx:732-767`) / bottom grid (`ModifierLibraryContent.tsx:1688-1718`). Reuse the existing `Min: X / Max: Y|∞` format from `ItemDetailPanel.tsx:1357`. Add to modifier detail header + list row. Display-only.

### #10 — Qty fields reject typed input
`parseInt(e.target.value) || N` on controlled number inputs snaps back mid-type (`CreateModifierPanel.tsx:742-759,901-927,1034-1044`; `ModifierLibraryContent.tsx:1691-1707,1537-1564`). The item order-qty fields already use the good pattern (`ItemDetailPanel.tsx:1859-1888`: `type=text inputMode=numeric`, `onFocus select()`, clamp). Mirror it. **Tests:** type "12" into Max=1 → 12; clear+retype works; price accepts "2.50".

### #11 — Add-ons + alcohol toggle
`Item.addonIds` + `isSpecialRequest` exist but are unsurfaced (`menu.ts:85-86`); alcohol is system tag id 1. **Fix:** Add-Ons section reusing `addonIds` (define what it references); alcohol = toggle that adds/removes tag id 1 (no new field). Likely no migration.

### #12 — Size pricing
Already modeled: `isSizeModifier` on Modifier/Option (`menu.ts:173,193`), per-size surcharge via join `maxLimit` ⟷ option `price` bridge (`excelParser.ts:448-457`); previews already special-case size modifiers. Sizes are already custom (free text). **Fix:** likely just first-class UX over the existing mechanism + surface selected sizes in the Modifier Options section. No schema change. Coupled to #25 in Excel.

### #13 — Tag icon config
Icon/color picker hidden behind tiny hover-only triggers; assign/configure/delete overloaded on one tile; duplicated in item + category panels (`ItemDetailPanel.tsx:1494-1637`, `CategoryDetailPanel.tsx:469-573`, `TagIconPicker.tsx`). **Fix (needs UX decision):** always-visible config affordance, separate assign from configure, possibly a single tag-management hub. Preserve `tag.isSystem` (no delete).

### #14 — Multi-level subcategory
Model supports arbitrary nesting (`parentCategoryId`, recursive cascade-delete `menuStore.ts:236-249`). UI limits to one level: root list (`CategoryColumns.tsx:46`), one-level `getSubcategories` (`:51`), flat chip render (`CategoryColumn.tsx:393-471`), "Add Subcategory" always parents to root (`:221`), item rollup only direct children (`:58-79`). **Fix:** recursive render + parent-to-active-subcat + recursive deduped item rollup + cycle guard. No migration. Confirm POS accepts depth.

### #15 — Modifier→item linkage
Modifier detail shows nested-modifier linkage both ways (`ModifierLibraryContent.tsx:1233-1241,1300-1408`) but not which items use it. Reverse data in `itemModifiers` join. **Fix:** add read-only "Used by items" section mirroring the "Nested under" pattern + count badge on list rows. (Overlaps #26 reverse lookups.)

### #16 — Reorder modifier options (create flow)
DnD already works in library (`reorderModifierOptions`, `menuStore.ts:1031-1053`; native HTML5 in `ModifierDetail`). Missing only in `CreateModifierPanel` (local `OptionDraft[]`, add/remove only). **Fix:** port the same native-DnD pattern. No dependency.

### #17 — Duplicate items/modifiers
No duplicate action exists. `duplicateItem` must clone Item row + `ItemModifier` + `CategoryItem` joins (tags/allergens are inline CSV, copy free). `duplicateModifier` must clone Modifier + `ModifierModifierOption` joins; decide share-vs-deep-clone for options and nested children (recursive w/ visited-set). Compute fresh ids functionally to avoid collisions. No migration.

### #18 — Reorder categories/items
`sortOrder` fields exist (`menu.ts:39,131`), lists render sorted, but `sortOrder` only set at creation; grip icons are decorative. No `reorderCategories`/`reorderItems` actions. **Fix:** 2 store actions + native DnD on columns/rows respecting scope + read-only lock. Subcat chip reorder optional.

### #19 — Move items between categories
Membership only via `CategoryItem` join; no in-item picker; today = remove+re-add across columns. **Fix:** cross-column drop on #18's DnD → `removeCategoryItem` + `addCategoryItem` (or atomic `moveItemToCategory`). Preserve other memberships. Decide move vs copy.

### #20 — Station Select-all
`StationsContent.tsx` uses per-item checkboxes, no bulk. `StationItemsModal` + `bulkSetItemsForStation` (`menuStore.ts:1481`) already implement it but the modal is **unmounted dead code**. **Fix:** add Select-all/Clear (scoped to search filter) to station columns, or wire up the existing modal.

### #21 — Image upload
Image fields exist on types (`Menu.picture`, `Category.image/kioskImage`, `Item.*Image` ×5) but no UI and **no Supabase Storage** anywhere (client is auth-only). **Fix (L):** bucket + RLS, `imageUpload.ts`, shared `ImageUploadField` in 3 panels. Decide which slots + stored value format (verify against Excel/POS contract).

### #22 — Project nav
`TopBar.tsx:178-186` already has Switch-project → `closeWorkspace()` + `/workspaces`. Likely discoverability. **Fix:** clearer back-arrow/"Projects" label and/or LeftSidebar entry (reuse `closeWorkspace` so the lock releases + autosave flushes).

### #23 — Modifier option & pricing overview
No aggregate view; option price lives per-assignment on `modifierModifierOptions.maxLimit`, so same option can differ per modifier. **Fix:** add a read-only `libView:'overview'` table (Modifier | Option | price | qty | default | channels) in `ModifierLibraryContent`. Keep editing authoritative in ModifierDetail (one write path). Window/paginate large catalogs.

### #24 — Kiosk preview fidelity
Fixed portrait 9:16, app chrome (not kiosk top-nav), pill category tabs that flatten subcategories, 2-col cards, forces customize for every item, drops pizza-side. **Fix (L, needs spec):** match real dimensions/orientation, add kiosk top-nav, decide nested category nav, match cards, reconcile modifier-less flow + pizza sides. Reuse `ModifierPanel` helpers. Shares #2 availability gap.

### #25 — 3PO pricing
**No "Item 3PO" sheet exists** in exporter/parser or either sample workbook; 3PO = 3 flat absolute-override columns on the Item sheet; modifier options have none; no upcharge/percent mode persisted. **Fix (L, blocked):** confirm POS sheet contract, then either inline mode+value columns (Option A) or a dedicated sheet keyed by id (Option B) — keep writing resolved absolute prices for POS compat. New `ThreePoPriceRule` on Item + ModifierOption, v17 migration backfilling from existing fields. Must not clobber the size surcharge bridge (#12).

### #26 — Relationship view
See §4. Bulk tab covers forward; rescope to reverse lookups only.

### #27 — Clickable navigation
Selection via store IDs + `activeTab`, all same-tab today; Bulk drill stays in its columns. **Blocked on #1** — `setActiveTab` discards dirty panels. **Fix (after #1):** `goToEntity` helpers (set tab + selection together) + dirty-guard; item case is ambiguous (multiple categories/menus). Source the clickable links from #26 reverse lookups + #15.

---

## Technical-notes follow-ups (from brief §🔧)
- **maxSelection depends on toggles** — unhandled cases need Aamir↔Shaheer alignment; not yet codified. Relates to #6/#8/#9. Get the shared screenshots and write down the truth table before touching `canPressDone`/min-max logic.
- **Excel export rework (Aamir)** — coordinate header ordering, `settingId`/`''`-vs-`null` consistency (`buildMenuRows:122`, `buildCategoryRows:159` write `''`; Item uses `null`), and the parser ignoring the `Setting` sheet. Don't reorder headers without his canonical schema.
- **Size modifier guidance** — confirmed: reuse the custom size-modifier mechanism (don't hardcode sizes), and ensure selected sizes show in the Modifier Options section.
