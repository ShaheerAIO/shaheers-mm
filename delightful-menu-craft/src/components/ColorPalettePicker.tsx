import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorPalettePickerProps {
  /** Allowed colors (the POS palette). */
  palette: readonly string[];
  /** Currently selected color. */
  value: string;
  onChange: (color: string) => void;
  /** Size of the trigger swatch, e.g. 'h-5 w-5' (compact) or 'h-8 w-12' (panel). */
  triggerClassName?: string;
  title?: string;
}

/**
 * A color picker constrained to a fixed palette. Renders a swatch button that
 * opens a popover grid of allowed colors — replaces free `<input type="color">`
 * so users can only choose POS-valid colors.
 */
export function ColorPalettePicker({ palette, value, onChange, triggerClassName, title }: ColorPalettePickerProps) {
  const current = (value || '').trim().toLowerCase();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('rounded border border-border cursor-pointer p-0', triggerClassName ?? 'h-8 w-12')}
          style={{ background: value || 'transparent' }}
          title={title ?? 'Choose color'}
          aria-label={title ?? 'Choose color'}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-6 gap-1.5">
          {palette.map((c) => {
            const selected = c.toLowerCase() === current;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className={cn(
                  'h-6 w-6 rounded-full border transition-transform hover:scale-110',
                  selected ? 'ring-2 ring-offset-1 ring-foreground border-transparent' : 'border-border/50',
                )}
                style={{ background: c }}
                title={c}
                aria-label={`Color ${c}`}
                aria-pressed={selected}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
