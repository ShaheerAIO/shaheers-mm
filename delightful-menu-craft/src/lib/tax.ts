import type { CustomTax, Item } from '@/types/menu';

/** Resolve a custom tax by id, or undefined for standard/none. */
export function getCustomTax(
  id: number | undefined,
  taxes: CustomTax[],
): CustomTax | undefined {
  if (id == null) return undefined;
  return taxes.find((t) => t.id === id);
}

/**
 * Effective tax rate (percent) for an item:
 *  - 0 if the item is not taxed (salesTax false)
 *  - the custom tax rate if customTaxId resolves to a known tax (overrides standard)
 *  - the standard rate otherwise
 */
export function effectiveItemTaxRate(
  item: Pick<Item, 'salesTax' | 'customTaxId'>,
  customTaxes: CustomTax[],
  standardRate: number,
): number {
  if (!item.salesTax) return 0;
  return getCustomTax(item.customTaxId, customTaxes)?.rate ?? standardRate;
}
