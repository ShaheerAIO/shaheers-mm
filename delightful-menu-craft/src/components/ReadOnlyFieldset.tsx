import type { ReactNode } from 'react';
import { useIsReadOnly } from '@/lib/workspaceSync';

/**
 * Wraps an edit form so every descendant <input>/<select>/<textarea>/<button>
 * is natively disabled when the open project is in view-only mode. Uses a
 * `display: contents` fieldset so it adds no layout box of its own. Navigation
 * controls (close/back, tab switches, entity selection) live OUTSIDE these
 * wrappers and stay interactive so viewers can still inspect everything.
 */
export function ReadOnlyFieldset({ children }: { children: ReactNode }) {
  const isReadOnly = useIsReadOnly();
  return (
    <fieldset disabled={isReadOnly} className="contents">
      {children}
    </fieldset>
  );
}
