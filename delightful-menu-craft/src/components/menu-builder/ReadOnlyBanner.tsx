import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  useWorkspaceSession,
  useIsReadOnly,
  takeOver,
  forceTakeOver,
} from '@/lib/workspaceSync';

/**
 * Shown across the top of the builder when this tab is viewing a project it
 * doesn't hold the edit lock for. Members can take over once the lock is free
 * or stale; admins can force a take-over of a live lock.
 */
export function ReadOnlyBanner() {
  const isReadOnly = useIsReadOnly();
  const { lockedByEmail, canTakeOver } = useWorkspaceSession();
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState<'take' | 'force' | null>(null);

  if (!isReadOnly) return null;

  const handleTakeOver = async () => {
    setBusy('take');
    try {
      await takeOver();
    } finally {
      setBusy(null);
    }
  };

  const handleForce = async () => {
    setBusy('force');
    try {
      await forceTakeOver();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
      <span className="flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" />
        <span>
          {lockedByEmail ? (
            <>View only — <strong>{lockedByEmail}</strong> is editing this project.</>
          ) : (
            <>View only — no one is editing. Take over to edit.</>
          )}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!canTakeOver || busy !== null}
          onClick={() => void handleTakeOver()}
        >
          {busy === 'take' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Take over
        </Button>
        {isAdmin && (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy !== null}
            onClick={() => void handleForce()}
            title="Force the current editor to hand over (admin only)"
          >
            {busy === 'force' ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Requesting hand-over…
              </>
            ) : (
              'Force take over'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
