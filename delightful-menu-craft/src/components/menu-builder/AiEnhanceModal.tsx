import { useEffect } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { useAiEnhance } from '@/hooks/useAiEnhance';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import type { AiPatch } from '@/types/menu';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KIND_META: Record<
  AiPatch['kind'],
  { label: string; color: string }
> = {
  item_station: { label: 'Station', color: 'bg-[var(--aio-info-bg)] text-[var(--aio-info)] ring-[var(--aio-info-edge)]' },
  item_rename: { label: 'Rename', color: 'bg-[var(--aio-accent-soft)] text-[var(--aio-accent-text)] ring-[var(--aio-accent-edge)]' },
  item_description: { label: 'Description', color: 'bg-accent2-soft text-accent2 ring-accent2' },
  category_rename: { label: 'Category', color: 'bg-ok-bg text-ok ring-ok-edge' },
};

const CONF_META: Record<
  AiPatch['confidence'],
  { label: string; color: string }
> = {
  high: { label: 'High', color: 'text-ok' },
  medium: { label: 'Med', color: 'text-warn' },
  low: { label: 'Low', color: 'text-danger' },
};

function kindCounts(patches: AiPatch[]) {
  return patches.reduce<Record<string, number>>(
    (acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }),
    {},
  );
}

export function AiEnhanceModal({ open, onOpenChange }: Props) {
  const { isDataLoaded } = useMenuStore();
  const {
    status,
    result,
    error,
    accepted,
    run,
    togglePatch,
    acceptAll,
    rejectAll,
    applySelected,
    dismiss,
  } = useAiEnhance();

  // Fire the API call as soon as the modal becomes visible
  useEffect(() => {
    if (open && status === 'idle' && isDataLoaded) {
      run();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    dismiss();
    onOpenChange(false);
  };

  const handleApply = () => {
    applySelected();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) handleClose();
  };

  const acceptedCount = accepted.size;
  const totalPatches = result?.patches.length ?? 0;
  const counts = result ? kindCounts(result.patches) : {};

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 bg-card border-[var(--aio-border)]">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[var(--aio-border)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="ai-orb" aria-hidden="true">
              <Sparkles />
            </span>
            <DialogTitle className="text-ink">AI Menu Enhancement</DialogTitle>
          </div>
          <DialogDescription className="text-ink-muted text-sm mt-1">
            {status === 'loading' && 'Analysing your menu with Claude Haiku…'}
            {status === 'reviewing' && result?.summary}
            {status === 'error' && 'Something went wrong.'}
            {status === 'idle' && 'Preparing…'}
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-ink-muted">
              <Loader2 className="w-10 h-10 animate-spin text-[var(--aio-accent-text)]" />
              <p className="text-sm">This usually takes 5–15 seconds for large menus…</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-ink-muted px-6">
              <AlertTriangle className="w-10 h-10 text-danger" />
              <p className="text-sm font-medium text-danger">Enhancement failed</p>
              <p className="text-xs text-ink-faint text-center max-w-sm break-words">{error}</p>
              <button
                onClick={() => run()}
                className="mt-2 px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary text-white transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Review table */}
          {status === 'reviewing' && result && (
            <div>
              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-[var(--aio-border)] text-xs text-ink-muted">
                {Object.entries(counts).map(([kind, n]) => {
                  const meta = KIND_META[kind as AiPatch['kind']];
                  return (
                    <span
                      key={kind}
                      className={cn('px-2 py-0.5 rounded-full ring-1', meta.color)}
                    >
                      {n} {meta.label}
                    </span>
                  );
                })}
                {result.newStations.length > 0 && (
                  <span className="text-ink-faint">
                    New stations: {result.newStations.join(', ')}
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between px-6 py-2 border-b border-[var(--aio-border)] text-xs">
                <span className="text-ink-faint">
                  {acceptedCount} / {totalPatches} proposals selected
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={acceptAll}
                    className="text-[var(--aio-accent-text)] hover:text-[var(--aio-accent-text)] transition-colors"
                  >
                    Accept all
                  </button>
                  <button
                    onClick={rejectAll}
                    className="text-ink-faint hover:text-ink transition-colors"
                  >
                    Reject all
                  </button>
                </div>
              </div>

              {/* Patch rows */}
              <div className="divide-y divide-[var(--aio-border)]">
                {result.patches.map((patch) => {
                  const isAccepted = accepted.has(patch.id);
                  const kindMeta = KIND_META[patch.kind];
                  const confMeta = CONF_META[patch.confidence];
                  return (
                    <label
                      key={patch.id}
                      className={cn(
                        'flex items-start gap-4 px-6 py-3 cursor-pointer transition-colors',
                        isAccepted
                          ? 'bg-white/[0.03] hover:bg-white/[0.05]'
                          : 'opacity-50 hover:opacity-75',
                      )}
                    >
                      <Checkbox
                        checked={isAccepted}
                        onCheckedChange={() => togglePatch(patch.id)}
                        className="mt-0.5 shrink-0 border-rule-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />

                      {/* Kind badge */}
                      <span
                        className={cn(
                          'shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ring-1',
                          kindMeta.color,
                        )}
                      >
                        {kindMeta.label}
                      </span>

                      {/* Change */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink font-medium truncate">{patch.label}</p>
                        <p className="text-xs text-ink-faint mt-0.5 line-clamp-1">
                          {patch.from ? (
                            <>
                              <span className="line-through text-ink-faint">{patch.from}</span>
                              <span className="mx-1.5 text-ink-faint">→</span>
                              <span className="text-ink-2">{patch.to}</span>
                            </>
                          ) : (
                            <span className="text-ink-2">{patch.to}</span>
                          )}
                        </p>
                      </div>

                      {/* Reason */}
                      <p className="hidden sm:block text-xs text-ink-faint max-w-[220px] line-clamp-2 shrink-0 text-right">
                        {patch.reason}
                      </p>

                      {/* Confidence */}
                      <span
                        className={cn(
                          'shrink-0 text-[10px] font-semibold uppercase tabular-nums mt-0.5',
                          confMeta.color,
                        )}
                      >
                        {confMeta.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'reviewing' && (
          <DialogFooter className="px-6 py-4 border-t border-[var(--aio-border)] shrink-0 flex items-center justify-between gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border border-rule text-ink-2 hover:bg-[var(--aio-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={acceptedCount === 0}
              className={cn(
                'px-5 py-2 text-sm font-semibold rounded-lg transition-colors',
                acceptedCount > 0
                  ? 'bg-primary hover:bg-primary text-white'
                  : 'bg-surface-2 text-ink-faint cursor-not-allowed',
              )}
            >
              Apply {acceptedCount > 0 ? `${acceptedCount} change${acceptedCount !== 1 ? 's' : ''}` : 'changes'}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
