import { useState, useMemo } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TAG_ICONS, TAG_COLORS, resolveTagIcon, type TagIconDef } from '@/lib/tagIcons';

interface TagIconPickerProps {
  icon: string | undefined;
  color: string | undefined;
  onChangeIcon: (iconName: string | undefined) => void;
  onChangeColor: (color: string) => void;
  /** Custom className for the trigger button. Defaults to the inline hover-reveal style. */
  triggerClassName?: string;
}

export function TagIconPicker({
  icon,
  color,
  onChangeIcon,
  onChangeColor,
  triggerClassName,
}: TagIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TAG_ICONS;
    return TAG_ICONS.filter(
      (d) => d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q)
    );
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, TagIconDef[]>();
    for (const d of filtered) {
      if (!map.has(d.group)) map.set(d.group, []);
      map.get(d.group)!.push(d);
    }
    return map;
  }, [filtered]);

  const CurrentIcon = resolveTagIcon(icon);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Set icon & color"
          onClick={(e) => e.stopPropagation()}
          className={
            triggerClassName ??
            'ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-primary transition-opacity'
          }
        >
          {CurrentIcon
            ? <CurrentIcon className="w-2.5 h-2.5" />
            : <ImageIcon className="w-2.5 h-2.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        align="start"
        side="bottom"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color palette */}
        <div className="mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5 mb-1.5">
            Color
          </p>
          <div className="flex flex-wrap gap-1.5 px-0.5">
            {TAG_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                onClick={() => onChangeColor(c.value)}
                className={cn(
                  'w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none',
                  color === c.value && 'ring-2 ring-offset-2 ring-foreground scale-110'
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-border my-2" />

        {/* Icon search */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons..."
          className="w-full text-xs px-2 py-1 rounded border border-border bg-muted/40 mb-2 outline-none focus:border-primary/50"
          autoFocus
        />

        {/* Clear icon */}
        {icon && (
          <button
            type="button"
            onClick={() => { onChangeIcon(undefined); setOpen(false); }}
            className="w-full text-left text-xs text-muted-foreground hover:text-destructive px-1 py-1 mb-1 flex items-center gap-1 rounded hover:bg-destructive/5"
          >
            <X className="w-3 h-3" /> Clear icon
          </button>
        )}

        {/* Icon grid */}
        <div className="max-h-52 overflow-y-auto space-y-2">
          {groups.size === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No icons match</p>
          ) : (
            Array.from(groups.entries()).map(([group, defs]) => (
              <div key={group}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5 mb-1">
                  {group}
                </p>
                <div className="flex flex-wrap gap-0.5">
                  {defs.map((d) => {
                    const Icon = d.icon;
                    const isSelected = icon === d.name;
                    return (
                      <button
                        key={d.name}
                        type="button"
                        title={d.label}
                        onClick={() => { onChangeIcon(d.name); setOpen(false); }}
                        className={cn(
                          'w-7 h-7 rounded flex items-center justify-center transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
