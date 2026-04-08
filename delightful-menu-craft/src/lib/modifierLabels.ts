import type { Modifier, ModifierOption } from '@/types/menu';

/** Label for dropdowns: internal name plus POS when it differs. */
export function formatModifierOptionForSelect(o: ModifierOption): string {
  const name = o.optionName.trim() || '(unnamed)';
  const pos = o.posDisplayName?.trim();
  if (pos && pos !== o.optionName) return `${name} — POS: ${pos}`;
  return name;
}

/** Label for nested-modifier / library dropdowns. */
export function formatModifierForSelect(m: Modifier): string {
  const name = m.modifierName.trim() || '(unnamed)';
  const pos = m.posDisplayName?.trim();
  if (pos && pos !== m.modifierName) return `${name} — POS: ${pos}`;
  return name;
}
