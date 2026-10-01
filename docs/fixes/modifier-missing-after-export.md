# Fix: modifier missing after config file export/import

## Reported issue

A modifier was attached to an item, the item was correctly mapped to a category, and the modifier displayed correctly on the POS. After the menu was exported and then imported through AIO Menu Manager, the modifier was no longer attached to the item.

## Root cause

The import side was not at fault. `parseItemModifiers` in `excelParser.ts` reads every row of the **Item Modifiers** sheet, and `importData` in `menuStore.ts` stores those rows unchanged.

The link was lost on **export**. The POS forbids linking a *nested* modifier (a child that lives inside another modifier) directly to an item or category. To respect that rule, `buildWorkbook` in `excelExporter.ts` leaves out any Item Modifiers or Category Modifiers row that points at a nested modifier.

The bug was in how the exporter decided what counts as "nested". It treated a modifier as nested if **either** of these was true:

1. Another modifier listed it in its `modifierIds`.
2. Its own `isNested` flag was `true`.

The builder UI (`ItemDetailPanel.getNestedModifiers` and `ModifierLibraryContent.childModifiers`) uses a different rule. A modifier is a child only when a parent claims it: the parent lists it in `modifierIds`, or, if the parent's list is empty, the modifier's `parentModifierId` points at that parent. A bare `isNested` flag means nothing to the UI.

So a modifier could carry a leftover `isNested: true` (or a `parentModifierId` pointing at a parent that no longer lists it). The UI showed it as an ordinary top-level modifier attached to the item, and the POS accepted it. The exporter, though, classified it as nested and silently dropped the item link. Importing that file then produced an item with no modifier.

### How modifiers end up with leftover nesting data

- **"Switch to Flat Options"** in the modifier library (`handleSwitchMode`) said it would "unlink N nested modifiers", but it only cleared the parent's `modifierIds`. Every child kept `isNested: true` and `parentModifierId = <parent>`.
- **The item modifier picker** (`availableModifiers` in `ItemDetailPanel.tsx`) offered every modifier, including ones that are currently nested children, so they could be attached directly to an item. The bulk editor (`BulkColumns.tsx`) already filtered these out; the item panel did not.

## Reproduction

The real exporter was run on minimal menus with one item linked to modifier 10, and the resulting **Item Modifiers** sheet was checked:

| Scenario | Before fix | After fix |
|---|---|---|
| Plain modifier on an item | kept | kept |
| Modifier has `isNested: true` but no parent | **dropped** | kept |
| Modifier points at parent 20, but parent 20's `modifierIds` lists only other children | **dropped** | kept |
| Real nested child (parent still claims it) also attached to the item | dropped, as the POS requires | dropped, and the child is now exported with `isNested: true` |
| Normal nesting from a previous Menu Manager export (child linked to its parent only by `parentModifierId`) | correct | correct |

## Changes

### 1. New shared helper: `delightful-menu-craft/src/lib/modifierNesting.ts`

`buildModifierNesting(modifiers)` returns `childToParent` (child id → parent id) and `nestedIds`. For each parent it resolves the children exactly the way the builder UI does:

- the parent's own `modifierIds`, if that list names modifiers that exist;
- otherwise, the modifiers whose `parentModifierId` points at the parent.

The `isNested` flag is deliberately ignored, because it can outlive the parent link.

**Why:** the exporter and the UI must agree on what "nested" means. Otherwise the export can disagree with what the operator sees, which is exactly how this bug happened.

### 2. Exporter: `delightful-menu-craft/src/lib/excelExporter.ts`

- Removed the local `buildModifierNesting` and now uses the shared helper.
- Item Modifiers and Category Modifiers rows are filtered using the helper's `nestedIds`.
- The Modifier sheet's `isNested` and `parentModifierId` columns are now derived from the helper instead of copied from stored fields. A top-level modifier no longer exports with an old parent id, and a real nested child is always exported with `isNested: true` and its parent id.
- Parent-before-child ordering (`sortModifiersParentFirst`) and the nested-child min/required logic in `buildModifierRows` use the same `nestedIds`.

**Why:** stops valid item links from being dropped, and keeps the Modifier sheet consistent with the links that are actually exported.

### 3. Item modifier picker: `delightful-menu-craft/src/components/menu-builder/ItemDetailPanel.tsx`

`availableModifiers` now excludes modifiers in `nestedIds`.

**Why:** stops operators from creating an item link that the POS rejects and the exporter therefore has to drop. This matches the bulk editor's existing behaviour.

### 4. "Switch to Flat Options": `delightful-menu-craft/src/components/modifier-library/ModifierLibraryContent.tsx`

On confirm, the parent now gets `modifierIds: ''` and `addNested: false`, and each former child gets `parentModifierId: 0` and `isNested: false`. This mirrors what `handleRemoveNestedModifier` already did for a single child. Modifiers whose `parentModifierId` points at the parent but that weren't in its `modifierIds` are unlinked too; otherwise clearing the list would make them resolve as children.

**Why:** before this change, the children were never actually unlinked. The UI kept finding them through `parentModifierId`, and they were left with stale nesting fields, which is one source of the bad data behind this bug.

### 5. Store migration v23: `delightful-menu-craft/src/store/menuStore.ts`

Repairs workspaces damaged by the old "Switch to Flat Options". A parent with an empty `modifierIds` that has options of its own (a `modifierModifierOptions` row or an option whose `parentModifierId` points at it) is flat, so any modifier still pointing at it gets `parentModifierId: 0` and `isNested: false`. Containers with no options of their own (normal nesting from a Menu Manager export) are untouched. Migrations also run on workspaces loaded from Supabase.

**Why:** the helper falls back to `parentModifierId`, so without this those leftover children still counted as nested and still lost their item links on export.

## Remaining limitation

A modifier that is **genuinely** nested inside a parent **and** also attached directly to an item is still left off the item on export, because the POS does not accept that link. The picker change prevents new cases. Workspaces that already contain one will still lose that item link on export. To keep it, either remove the modifier from its parent, or attach the parent to the item instead.

## Verification

- `npm run build` passes (no TypeScript errors).
- The before/after table above came from running the actual `exportToBlob` on test data and reading back the generated workbook.

## Recovering affected menus

Open the workspace with this build (the v23 migration repairs leftovers from the old "Switch to Flat Options") and re-export. If the modifier is still missing from the item, it is still claimed by a parent modifier. Open it in the modifier library, and either remove it from that parent or attach the parent to the item instead.
