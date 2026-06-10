// Common POS sale-category classifications offered as dropdown suggestions.
// The stored value remains a free string — these are not an exhaustive enum.
export const SALE_CATEGORIES = [
  'Food Sales',
  'Liquor Sales',
  'Beer Sales',
  'Wine Sales',
  'Non-Alcoholic Beverage',
  'Retail',
  'Non-Taxable',
] as const;

export const DEFAULT_SALE_CATEGORY = 'Food Sales';
