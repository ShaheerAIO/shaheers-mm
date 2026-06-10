import type { ReactNode } from 'react';
import { Check, ChevronRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Tri-state box. Orange check = directly selected (will be edited);
 *  blue dash = indeterminate (a descendant is selected — orientation only). */
function BulkCheckbox({
  checked,
  indeterminate,
  disabled,
  onToggle,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={cn(
        'shrink-0 w-[15px] h-[15px] rounded-[4px] border flex items-center justify-center transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        checked
          ? 'bg-primary border-primary text-primary-foreground'
          : indeterminate
            ? 'bg-blue-500/15 border-blue-500 text-blue-500 dark:text-blue-400'
            : 'border-input bg-transparent hover:border-primary/50',
      )}
    >
      {checked ? (
        <Check className="w-2.5 h-2.5" strokeWidth={3} />
      ) : indeterminate ? (
        <Minus className="w-2.5 h-2.5" strokeWidth={3} />
      ) : null}
    </button>
  );
}

export interface BulkRowData {
  key: string;
  id: number;
  name: string;
  /** Compact right-aligned info (price, stock badge, counts). */
  meta?: ReactNode;
  /** Optional replacement for the plain name span (inline rename input). */
  nameNode?: ReactNode;
  /** Level accent / category color dot. */
  color?: string;
  /** Indent depth (subcategories). */
  depth?: number;
  /** Whether the row can be drilled into (opens the next column). */
  drillable: boolean;
}

interface BulkColumnProps {
  title: string;
  accent: string;
  rows: BulkRowData[];
  count: number;
  drilledId: number | null;
  onDrill: (id: number) => void;
  selected: Set<string>;
  isIndeterminate: (key: string) => boolean;
  isCascadeTarget: (key: string) => boolean;
  onToggle: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
  emptyText: string;
  widthClass?: string;
}

export function BulkColumn({
  title,
  accent,
  rows,
  count,
  drilledId,
  onDrill,
  selected,
  isIndeterminate,
  isCascadeTarget,
  onToggle,
  onToggleAll,
  emptyText,
  widthClass = 'w-[250px]',
}: BulkColumnProps) {
  const allKeys = rows.map((r) => r.key);
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const someSelected = !allSelected && allKeys.some((k) => selected.has(k));

  return (
    <div className={cn('shrink-0 flex flex-col min-h-0 border-r border-border', widthClass)}>
      {/* Column header */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center gap-2">
        <BulkCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          disabled={rows.length === 0}
          onToggle={() => onToggleAll(allKeys)}
        />
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="text-[11px] text-muted-foreground/70 tabular-nums ml-auto">{count}</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-3">{emptyText}</p>
        ) : (
          rows.map((row) => {
            const isChecked = selected.has(row.key);
            const isDrilled = drilledId === row.id;
            const indet = isIndeterminate(row.key);
            const inCascade = isCascadeTarget(row.key);
            return (
              <div
                key={row.key}
                onClick={() => row.drillable && onDrill(row.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 border-b border-border/50 select-none transition-colors text-xs',
                  row.drillable && 'cursor-pointer',
                  isChecked
                    ? 'bg-primary/10'
                    : isDrilled
                      ? 'bg-muted'
                      : inCascade
                        ? 'bg-blue-500/10'
                        : 'hover:bg-muted/50',
                )}
                style={row.depth ? { paddingLeft: 12 + row.depth * 14 } : undefined}
              >
                <BulkCheckbox
                  checked={isChecked}
                  indeterminate={indet}
                  onToggle={() => onToggle(row.key)}
                />
                {row.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                )}
                {row.nameNode ?? (
                  <span className="flex-1 truncate font-medium text-foreground">{row.name}</span>
                )}
                {row.meta}
                <ChevronRight
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    row.drillable
                      ? isDrilled
                        ? 'text-primary'
                        : 'text-muted-foreground/50'
                      : 'invisible',
                  )}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
