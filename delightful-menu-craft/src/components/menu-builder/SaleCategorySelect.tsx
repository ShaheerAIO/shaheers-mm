import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SALE_CATEGORIES } from '@/lib/saleCategories';
import { cn } from '@/lib/utils';

const CUSTOM_VALUE = '__custom__';

interface SaleCategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  triggerClassName?: string;
}

/** Dropdown of known sale categories with a "Custom…" escape hatch for free text. */
export function SaleCategorySelect({ value, onChange, id, triggerClassName }: SaleCategorySelectProps) {
  const isKnown = (SALE_CATEGORIES as readonly string[]).includes(value);
  const [customOverride, setCustomOverride] = useState(false);
  const custom = customOverride || (!!value && !isKnown);

  // Keep override in sync when the value changes externally (e.g. switching items).
  useEffect(() => {
    if (isKnown) setCustomOverride(false);
  }, [value, isKnown]);

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={custom ? CUSTOM_VALUE : isKnown ? value : ''}
        onValueChange={(v) => {
          if (v === CUSTOM_VALUE) {
            setCustomOverride(true);
            onChange('');
          } else {
            setCustomOverride(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger id={id} className={cn('w-full', triggerClassName)}>
          <SelectValue placeholder="Select sale category" />
        </SelectTrigger>
        <SelectContent>
          {SALE_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Custom sale category"
          className="input-field w-full text-sm"
          aria-label="Custom sale category"
        />
      )}
    </div>
  );
}
