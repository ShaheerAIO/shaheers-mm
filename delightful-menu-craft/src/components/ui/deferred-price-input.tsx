import { useRef, useState, type ReactNode } from 'react';
import { NumberStepperInput } from '@/components/ui/number-stepper-input';

interface DeferredPriceInputProps {
  /** The persisted price. */
  value: number;
  /**
   * Fired on blur, Enter, or a stepper click — and only when the price actually
   * changed. Unlike `PriceStepperInput` this never fires per keystroke, so a
   * commit can safely open a confirmation prompt.
   */
  onCommit: (price: number) => void;
  step?: number;
  prefix?: ReactNode;
  wrapperClassName?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Money input that defers its commit to blur/Enter/step. The in-flight text is
 * mirrored in a ref because the blur that follows a stepper click or Escape fires
 * before the re-render, and must not re-commit an edit those handlers just cleared.
 * `null` text means "show the persisted value".
 */
export function DeferredPriceInput({
  value,
  onCommit,
  step = 1,
  prefix,
  wrapperClassName,
  className,
  placeholder,
  disabled,
  'aria-label': ariaLabel,
}: DeferredPriceInputProps) {
  const [text, setText] = useState<string | null>(null);
  const textRef = useRef<string | null>(null);

  const setDraft = (next: string | null) => {
    textRef.current = next;
    setText(next);
  };

  const commit = (raw: string) => {
    setDraft(null);
    const trimmed = raw.trim();
    if (trimmed === '') return;
    const next = Math.max(0, parseFloat(trimmed) || 0);
    if (next === value) return;
    onCommit(next);
  };

  const displayed = text ?? (value ? value.toFixed(2) : '');
  const stepBase = text !== null && text !== '' ? Math.max(0, parseFloat(text) || 0) : value;

  return (
    <NumberStepperInput
      inputMode="decimal"
      value={displayed}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setDraft(raw);
      }}
      onStep={(delta) => commit(String(Math.max(0, Math.round((stepBase + delta) * 100) / 100)))}
      onBlur={() => commit(textRef.current ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          // Discard, then let the blur no-op on the empty draft.
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      step={step}
      prefix={prefix}
      wrapperClassName={wrapperClassName}
      className={className}
    />
  );
}
