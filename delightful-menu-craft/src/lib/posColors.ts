// POS-allowed color palettes. The POS importer/validator only accepts colors
// from these exact lists — menu button colors and category colors are separate
// palettes. Sourced from the POS import validation rules. Keep these in sync
// with the validator; any color outside the list is rejected on import.

export const MENU_COLOR_PALETTE = [
  '#FCA98F', '#F7B897', '#FED4A0', '#FDD685', '#FEF2AD',
  '#E2EEAF', '#D7EB9E', '#C2F1CA', '#9FE7FE', '#85C6E9',
] as const;

export const CATEGORY_COLOR_PALETTE = [
  '#FF7B42', '#FFAD73', '#FDD092', '#FECA6F', '#FDEB97',
  '#DCEA9F', '#C3E68D', '#AEE9C1', '#7BDCFD', '#6FB9E7',
  '#8897D6', '#AA8EC6', '#C293C0', '#C8C5E2', '#F59EBE',
  '#F6ACAD', '#F9C5C6', '#FE9194', '#FEA7A9', '#FB8E81',
  '#FCA59A', '#F0B5AF', '#8DC4BA', '#ACE3D9', '#AFD6CF',
  '#75D1D9', '#A9E2E8', '#DDD17E', '#E4DA98', '#EEE4A1',
] as const;

export const DEFAULT_MENU_COLOR = MENU_COLOR_PALETTE[0];
export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_PALETTE[0];

// Pick a palette color not already used by siblings (falls back to the full
// palette when all are taken). Deterministic: returns the first unused color.
export const pickUnusedCategoryColor = (siblingColors: string[]): string => {
  const used = new Set(siblingColors.map((c) => c.trim().toLowerCase()));
  return CATEGORY_COLOR_PALETTE.find((c) => !used.has(c.toLowerCase())) ?? DEFAULT_CATEGORY_COLOR;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Coerce a color to the nearest allowed palette entry. Returns the canonical
// palette casing for an exact match, the closest color (by RGB distance) for a
// valid-but-off-palette hex, the fallback for an unparseable value, and leaves
// an empty value untouched. Used to repair legacy/off-palette stored colors.
const snapToPalette = (color: string, palette: readonly string[], fallback: string): string => {
  const raw = (color || '').trim();
  if (!raw) return color;
  const exact = palette.find((p) => p.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const rgb = hexToRgb(raw);
  if (!rgb) return fallback;
  let best = fallback;
  let bestDist = Infinity;
  for (const p of palette) {
    const prgb = hexToRgb(p)!;
    const dist = (rgb[0] - prgb[0]) ** 2 + (rgb[1] - prgb[1]) ** 2 + (rgb[2] - prgb[2]) ** 2;
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return best;
};

export const snapToMenuColor = (color: string): string => snapToPalette(color, MENU_COLOR_PALETTE, DEFAULT_MENU_COLOR);
export const snapToCategoryColor = (color: string): string => snapToPalette(color, CATEGORY_COLOR_PALETTE, DEFAULT_CATEGORY_COLOR);
