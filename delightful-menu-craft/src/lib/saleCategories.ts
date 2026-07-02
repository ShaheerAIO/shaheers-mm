// Common POS sale-category classifications offered as dropdown suggestions.
// The stored value remains a free string — these are not an exhaustive enum.
export const SALE_CATEGORIES = [
  'Food Sales',
  'Liquor Sales',
  'Beer Sales',
  'Wine Sales',
  'Non-Alcoholic Beverages Sales',
  // commented Retail and Non-Taxable as they are not in our menu manager
  // 'Retail',
  // 'Non-Taxable',
  'Non-Food Items',
  'Cocktails',
  'Mocktails',
  'Catering Sales'
] as const;

export const DEFAULT_SALE_CATEGORY = 'Food Sales';
