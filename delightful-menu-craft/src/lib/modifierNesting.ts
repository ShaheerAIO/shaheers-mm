import type { Modifier } from '@/types/menu';

// Nested-modifier structure: a child→parent map plus the set of modifier ids
// that are nested children. The POS forbids linking nested modifiers directly
// to items/categories and requires each nested modifier to point at its parent.
export interface ModifierNesting {
  childToParent: Map<number, number>;
  nestedIds: Set<number>;
}

const parseIdList = (csv: string | undefined): number[] =>
  String(csv || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

// Resolves a parent's children the same way the builder displays them: its own
// `modifierIds` list when that names existing modifiers, otherwise the modifiers
// whose `parentModifierId` points at it. A bare `isNested` flag is not enough —
// it can outlive the parent link, and treating it as authoritative drops item
// links for modifiers the builder shows as top-level.
export const buildModifierNesting = (mods: readonly Modifier[]): ModifierNesting => {
  const ids = new Set(mods.map((m) => m.id));
  const childToParent = new Map<number, number>();
  for (const m of mods) {
    const listed = parseIdList(m.modifierIds).filter((id) => id !== m.id && ids.has(id));
    const children = listed.length > 0
      ? listed
      : mods.filter((c) => c.id !== m.id && c.parentModifierId === m.id).map((c) => c.id);
    children.forEach((childId) => { if (!childToParent.has(childId)) childToParent.set(childId, m.id); });
  }
  return { childToParent, nestedIds: new Set(childToParent.keys()) };
};
