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
  item_station: { label: 'Station', color: 'bg-sky-500/20 text-sky-300 ring-sky-500/30' },
  item_rename: { label: 'Rename', color: 'bg-orange-500/20 text-orange-300 ring-orange-500/30' },
  item_description: { label: 'Description', color: 'bg-violet-500/20 text-violet-300 ring-violet-500/30' },
  category_rename: { label: 'Category', color: 'bg-teal-500/20 text-teal-300 ring-teal-500/30' },
};

const CONF_META: Record<
  AiPatch['confidence'],
  { label: string; color: string }
> = {
  high: { label: 'High', color: 'text-emerald-400' },
  medium: { label: 'Med', color: 'text-yellow-400' },
  low: { label: 'Low', color: 'text-red-400' },
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 bg-[hsl(var(--pos-shell-elevated))] border-[hsl(var(--pos-shell-border))]">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[hsl(var(--pos-shell-border))] shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-400 shrink-0" />
            <DialogTitle className="text-zinc-100">AI Menu Enhancement</DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-sm mt-1">
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
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-zinc-400">
              <Loader2 className="w-10 h-10 animate-spin text-orange-400" />
              <p className="text-sm">This usually takes 5–15 seconds for large menus…</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-zinc-400 px-6">
              <AlertTriangle className="w-10 h-10 text-red-400" />
              <p className="text-sm font-medium text-red-300">Enhancement failed</p>
              <p className="text-xs text-zinc-500 text-center max-w-sm break-words">{error}</p>
              <button
                onClick={() => run()}
                className="mt-2 px-4 py-2 text-sm rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Review table */}
          {status === 'reviewing' && result && (
            <div>
              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-[hsl(var(--pos-shell-border))] text-xs text-zinc-400">
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
                  <span className="text-zinc-500">
                    New stations: {result.newStations.join(', ')}
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between px-6 py-2 border-b border-[hsl(var(--pos-shell-border))] text-xs">
                <span className="text-zinc-500">
                  {acceptedCount} / {totalPatches} proposals selected
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={acceptAll}
                    className="text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Accept all
                  </button>
                  <button
                    onClick={rejectAll}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Reject all
                  </button>
                </div>
              </div>

              {/* Patch rows */}
              <div className="divide-y divide-[hsl(var(--pos-shell-border))]">
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
                        className="mt-0.5 shrink-0 border-zinc-600 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
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
                        <p className="text-sm text-zinc-200 font-medium truncate">{patch.label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                          {patch.from ? (
                            <>
                              <span className="line-through text-zinc-600">{patch.from}</span>
                              <span className="mx-1.5 text-zinc-700">→</span>
                              <span className="text-zinc-300">{patch.to}</span>
                            </>
                          ) : (
                            <span className="text-zinc-300">{patch.to}</span>
                          )}
                        </p>
                      </div>

                      {/* Reason */}
                      <p className="hidden sm:block text-xs text-zinc-500 max-w-[220px] line-clamp-2 shrink-0 text-right">
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
          <DialogFooter className="px-6 py-4 border-t border-[hsl(var(--pos-shell-border))] shrink-0 flex items-center justify-between gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border border-zinc-700 text-zinc-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={acceptedCount === 0}
              className={cn(
                'px-5 py-2 text-sm font-semibold rounded-lg transition-colors',
                acceptedCount > 0
                  ? 'bg-orange-500 hover:bg-orange-400 text-white'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
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
