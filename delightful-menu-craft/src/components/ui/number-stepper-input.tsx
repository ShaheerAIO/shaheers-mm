import type { InputHTMLAttributes, ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberStepperInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix'> {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Nudge the value by +1/-1 (or a custom amount) — wired up by the caller. */
  onStep: (delta: number) => void;
  step?: number;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  /** Rendered inside the box, before the input (e.g. a "$" sign). */
  prefix?: ReactNode;
  /** Classes for the bordered outer box (sizing, height, etc). */
  wrapperClassName?: string;
}

/**
 * A text input with +/- stepper buttons built into the existing input box,
 * used for all min/max/qty-style number fields so they're incrementable
 * without needing to select and retype the value.
 */
export function NumberStepperInput({
  onChange,
  onStep,
  step = 1,
  decrementDisabled,
  incrementDisabled,
  prefix,
  wrapperClassName,
  className,
  disabled,
  ...inputProps
}: NumberStepperInputProps) {
  return (
    <div
      className={cn(
        'input-field flex items-center gap-0 px-0.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
        disabled && 'opacity-50',
        wrapperClassName,
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || decrementDisabled}
        onClick={() => onStep(-step)}
        className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label="Decrease value"
      >
        <Minus className="w-2.5 h-2.5" />
      </button>
      {prefix}
      <input
        {...inputProps}
        disabled={disabled}
        onChange={onChange}
        className={cn('flex-1 min-w-0 bg-transparent outline-none text-center px-0.5', className)}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || incrementDisabled}
        onClick={() => onStep(step)}
        className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
        aria-label="Increase value"
      >
        <Plus className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}
