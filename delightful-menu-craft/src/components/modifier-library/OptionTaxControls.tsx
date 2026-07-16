import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CustomTax, Item } from '@/types/menu';

/** Tax state carried in create/edit forms, mirroring the item model. */
export type TaxDraft = { salesTax: boolean; customTaxId?: number };

/** Read-only label for a tax setting (undefined salesTax reads as taxed). */
export function taxLabel(
  tax: { salesTax?: boolean; customTaxId?: number },
  customTaxes: CustomTax[],
  standardRate: number,
): string {
  if (tax.salesTax === false) return 'No tax';
  const t = tax.customTaxId != null ? customTaxes.find((c) => c.id === tax.customTaxId) : undefined;
  return t ? `${t.name} · ${t.rate}%` : `Standard · ${standardRate}%`;
}

/** Tax dropdown shared by the Options Library and the change dialog. Mirrors ItemDetailPanel. */
export function TaxSelect({
  value,
  onChange,
  customTaxes,
  standardRate,
  triggerClassName,
}: {
  value: TaxDraft;
  onChange: (next: TaxDraft) => void;
  customTaxes: CustomTax[];
  standardRate: number;
  triggerClassName?: string;
}) {
  const selectValue = !value.salesTax
    ? 'none'
    : value.customTaxId != null && customTaxes.some((t) => t.id === value.customTaxId)
      ? String(value.customTaxId)
      : 'standard';

  const handleChange = (v: string) => {
    if (v === 'none') onChange({ salesTax: false, customTaxId: undefined });
    else if (v === 'standard') onChange({ salesTax: true, customTaxId: undefined });
    else onChange({ salesTax: true, customTaxId: Number(v) });
  };

  return (
    <Select value={selectValue} onValueChange={handleChange}>
      <SelectTrigger className={cn('h-8 text-xs', triggerClassName)}>
        <SelectValue>{taxLabel(value, customTaxes, standardRate)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No sales tax</SelectItem>
        <SelectItem value="standard">{`Standard rate (${standardRate}%)`}</SelectItem>
        {customTaxes.map((t) => (
          <SelectItem key={t.id} value={String(t.id)}>
            {`${t.name} · ${t.rate}%`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Dialog for changing an option's tax. When the option is shared (affectedItems
 * is non-empty) it warns that the change is global and lists the impacted items,
 * so the user can confirm they're editing the option they mean — options can
 * share a name, and this disambiguates by showing what actually gets touched.
 */
export function OptionTaxChangeDialog({
  open,
  optionName,
  initialTax,
  affectedItems,
  customTaxes,
  standardRate,
  onApply,
  onClose,
}: {
  open: boolean;
  optionName: string;
  initialTax: TaxDraft;
  affectedItems: Item[];
  customTaxes: CustomTax[];
  standardRate: number;
  onApply: (next: TaxDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TaxDraft>(initialTax);

  // Reset the working draft each time the dialog opens for an option.
  useEffect(() => {
    if (open) setDraft(initialTax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTax.salesTax, initialTax.customTaxId]);

  const isGlobal = affectedItems.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">Tax · {optionName}</DialogTitle>
          <DialogDescription>
            {isGlobal
              ? 'This option is shared. Changing its tax applies everywhere the option is used — including the items below.'
              : 'Set the sales tax applied to this option.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tax</Label>
            <TaxSelect
              value={draft}
              onChange={setDraft}
              customTaxes={customTaxes}
              standardRate={standardRate}
              triggerClassName="w-full"
            />
          </div>

          {isGlobal && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Affected items ({affectedItems.length})
              </Label>
              <ScrollArea className="max-h-40 rounded-md border">
                <ul className="p-2 text-sm">
                  {affectedItems.map((it) => (
                    <li key={it.id} className="px-1 py-0.5 truncate">
                      {it.itemName}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onApply(draft); onClose(); }}>
            {isGlobal ? 'Apply everywhere' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
