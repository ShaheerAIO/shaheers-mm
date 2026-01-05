# Implementation Plan: Inline Modifier and Option Creation in Item Config

## Overview
Add functionality to create new modifiers and modifier options inline while configuring an item. Use a **second right sidebar** that slides in from the right, pushing the existing ItemDetailPanel to the left.

## User Requirements
1. ✅ Modifiers must have at least one option (cannot save with zero options)
2. ✅ All sidebar panels use the same width (320px)
3. ✅ On mobile (<1024px), fall back to modals instead of sidebars
4. ✅ Maximum 3 levels deep: Item → Modifier → Option
5. ✅ Add dark backdrop overlay on main content when sidebars are open

## Implementation Steps

### 1. Update Store State
- Add `isCreatingModifier: boolean`
- Add `isCreatingOption: boolean`
- Add corresponding setter actions

### 2. Create CreateModifierPanel Component
- Second-level sidebar for modifier creation
- Form for modifier settings (name, min/max, optional/required, channels)
- Options list with add existing/create new
- Validation: name required, at least 1 option required
- Save creates modifier + options + links to item

### 3. Create CreateOptionPanel Component
- Third-level sidebar for option creation
- Returns draft option data (not saved globally until modifier is saved)
- Simple form: name, POS name, in stock, size modifier

### 4. Update RightSidebar Component
- Support multiple stacked panels with slide transitions
- Add backdrop overlay
- Handle panel positioning with CSS transforms

### 5. Update ItemDetailPanel
- Add "New Modifier" button next to existing "Add" dropdown
- Button opens CreateModifierPanel

### 6. Mobile Responsive (Future Enhancement)
- Detect screen size
- Use modals instead of sidebars on small screens

## Technical Details

### Sidebar Layout
- Width: 320px each
- Level 1 (Item): translates -320px when Level 2 opens, -640px when Level 3 opens
- Level 2 (Modifier): translates -320px when Level 3 opens
- Level 3 (Option): no translation
- Transition: 300ms ease-in-out
- Backdrop: fixed overlay with bg-black/50

### Validation
- Modifier name required
- At least 1 option required
- Option name required

### Data Flow
1. User creates modifier with options
2. On save: Create Modifier → Create new options → Link options to modifier → Link modifier to item
3. All panels close and slide away
