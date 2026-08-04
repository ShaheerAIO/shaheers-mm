import type { Category } from '@/types/menu';

/**
 * Category nesting is capped at this many tiers *including the root*. A root
 * category is tier 1, its subcategories tier 2, and so on — so this allows a
 * root plus up to 4 levels of nested subcategories.
 */
export const MAX_CATEGORY_TIERS = 5;

/**
 * Depth of a category: 0 for a root (no parent), 1 for a direct subcategory,
 * etc. Cycle-safe against malformed parent chains.
 */
export function categoryDepth(categoryId: number, categories: Category[]): number {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const seen = new Set<number>();
  let depth = 0;
  let cur = byId.get(categoryId)?.parentCategoryId ?? null;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    depth++;
    cur = byId.get(cur)?.parentCategoryId ?? null;
  }
  return depth;
}

/**
 * Whether a new subcategory may be created under `parentId` without exceeding
 * MAX_CATEGORY_TIERS. The child would sit one tier below its parent.
 */
export function canAddSubcategory(parentId: number, categories: Category[]): boolean {
  // Child tier = parent depth + 2 (parent depth is 0-based; child is one deeper,
  // and tiers are 1-based). Allow while that stays within the cap.
  return categoryDepth(parentId, categories) + 2 <= MAX_CATEGORY_TIERS;
}

/**
 * All category ids in the subtree rooted at `rootId` (inclusive), depth-first in
 * sibling sortOrder. Cycle-safe.
 */
export function collectCategorySubtreeIds(rootId: number, categories: Category[]): number[] {
  const childrenByParent = new Map<number, Category[]>();
  for (const c of categories) {
    if (c.parentCategoryId == null) continue;
    const arr = childrenByParent.get(c.parentCategoryId) ?? [];
    arr.push(c);
    childrenByParent.set(c.parentCategoryId, arr);
  }
  const result: number[] = [];
  const seen = new Set<number>();
  const visit = (id: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
    const kids = (childrenByParent.get(id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    for (const k of kids) visit(k.id);
  };
  visit(rootId);
  return result;
}
