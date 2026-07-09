import { useEffect, useState } from 'react';

/**
 * Bridges a controlled numeric value (e.g. a min/max selection limit) with a
 * text input so the field can be fully cleared while typing instead of
 * snapping back to a floor/default value on every keystroke — which made it
 * impossible to replace a "0" with a fresh single- or double-digit number.
 *
 * The displayed text is only committed back to the numeric value once it
 * parses to a valid integer (via `commit`, which is expected to clamp it as
 * needed). While the field is empty the numeric value is left untouched, and
 * the text re-syncs from the numeric value on blur (if left empty) or
 * whenever the numeric value changes externally.
 */
export function useClearableIntInput(value: number, commit: (parsed: number) => void) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  return {
    value: text,
    onChange: (raw: string) => {
      if (!/^\d*$/.test(raw)) return;
      setText(raw);
      if (raw === '') return;
      commit(parseInt(raw, 10));
    },
    onBlur: () => {
      setText((current) => (current === '' ? String(value) : current));
    },
    /** Nudge the value up/down by `delta` (e.g. from stepper buttons). */
    step: (delta: number) => commit(value + delta),
  };
}
