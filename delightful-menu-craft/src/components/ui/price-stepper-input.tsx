import { useEffect, useState, type ReactNode } from 'react';
import { NumberStepperInput } from '@/components/ui/number-stepper-input';

interface PriceStepperInputProps {
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  prefix?: ReactNode;
  wrapperClassName?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * Decimal-money analogue of `useClearableIntInput`: wraps `NumberStepperInput`
 * with an internal string draft so intermediate states like "2." survive while
 * the user types a price (e.g. $2.75). Committing straight from a numeric value
 * re-parsed on every keystroke drops the decimal point mid-edit.
 */
export function PriceStepperInput({
  value,
  onCommit,
  step = 1,
  prefix,
  wrapperClassName,
  className,
  placeholder,
  disabled,
  onFocus,
}: PriceStepperInputProps) {
  const [text, setText] = useState(value ? String(value) : '');

  // Resync only when the value changed externally, so our own commit doesn't
  // clobber a mid-edit "2." (parseFloat("2.") === 2 === value → skip).
  useEffect(() => {
    if (parseFloat(text) !== value) setText(value ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <NumberStepperInput
      inputMode="decimal"
      value={text}
      onFocus={onFocus}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        if (raw !== '') onCommit(Math.max(0, parseFloat(raw) || 0));
      }}
      onStep={(delta) => onCommit(Math.max(0, Math.round((value + delta) * 100) / 100))}
      onBlur={() => setText(value ? value.toFixed(2) : '')}
      step={step}
      prefix={prefix}
      wrapperClassName={wrapperClassName}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
