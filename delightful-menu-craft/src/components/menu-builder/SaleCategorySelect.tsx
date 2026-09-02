import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMenuStore } from '@/store/menuStore';
import { cn } from '@/lib/utils';

const CUSTOM_VALUE = '__custom__';

interface SaleCategorySelectProps {
  /** Selected sale-category id, or undefined when nothing is chosen yet. */
  value: number | undefined;
  onChange: (id: number) => void;
  id?: string;
  triggerClassName?: string;
}

/**
 * Dropdown over the Sales Category catalog, with a "Custom…" option that adds a
 * new catalog entry (and its POS id) before selecting it.
 */
export function SaleCategorySelect({ value, onChange, id, triggerClassName }: SaleCategorySelectProps) {
  const salesCategories = useMenuStore((s) => s.salesCategories);
  const addSalesCategory = useMenuStore((s) => s.addSalesCategory);
  const [customName, setCustomName] = useState<string | null>(null);

  const selected = value != null ? salesCategories.find((c) => c.id === value) : undefined;

  const commitCustom = () => {
    const name = (customName ?? '').trim();
    if (!name) return;
    onChange(addSalesCategory(name));
    setCustomName(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={customName !== null ? CUSTOM_VALUE : selected ? String(selected.id) : ''}
        onValueChange={(v) => {
          if (v === CUSTOM_VALUE) {
            setCustomName('');
          } else {
            setCustomName(null);
            onChange(Number(v));
          }
        }}
      >
        <SelectTrigger id={id} className={cn('w-full', triggerClassName)}>
          <SelectValue placeholder="Select sale category" />
        </SelectTrigger>
        <SelectContent>
          {salesCategories.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {customName !== null && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitCustom(); } }}
            placeholder="New sale category name"
            className="input-field flex-1 text-sm"
            aria-label="New sale category name"
            autoFocus
          />
          <button
            type="button"
            onClick={commitCustom}
            disabled={!customName.trim()}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}
