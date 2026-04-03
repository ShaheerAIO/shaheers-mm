import { useState, useCallback } from 'react';
import { useMenuStore } from '@/store/menuStore';
import { enhanceMenu } from '@/lib/aiEnhance';
import type { AiPatch, AiEnhanceResult } from '@/types/menu';

type Status = 'idle' | 'loading' | 'reviewing' | 'error';

interface UseAiEnhanceReturn {
  status: Status;
  result: AiEnhanceResult | null;
  error: string | null;
  /** IDs of patches the user has accepted (starts as all of them) */
  accepted: Set<string>;
  run: () => Promise<void>;
  togglePatch: (id: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  applySelected: () => void;
  dismiss: () => void;
}

export function useAiEnhance(): UseAiEnhanceReturn {
  const { items, categories, categoryItems, stations, applyAiPatches } = useMenuStore();

  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<AiEnhanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const run = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setResult(null);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 60 seconds')), 60_000),
      );
      const res = await Promise.race([
        enhanceMenu({ items, categories, categoryItems, stations }),
        timeout,
      ]);
      setResult(res);
      // Default: accept all proposals
      setAccepted(new Set(res.patches.map((p) => p.id)));
      setStatus('reviewing');
    } catch (err) {
      console.error('[AI Enhance] error:', err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [items, categories, categoryItems, stations]);

  const togglePatch = useCallback((id: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const acceptAll = useCallback(() => {
    if (result) setAccepted(new Set(result.patches.map((p) => p.id)));
  }, [result]);

  const rejectAll = useCallback(() => setAccepted(new Set()), []);

  const applySelected = useCallback(() => {
    if (!result) return;
    const chosen: AiPatch[] = result.patches.filter((p) => accepted.has(p.id));
    applyAiPatches(chosen, result.newStations);
    dismiss();
  }, [result, accepted, applyAiPatches]);

  const dismiss = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setAccepted(new Set());
  }, []);

  return { status, result, error, accepted, run, togglePatch, acceptAll, rejectAll, applySelected, dismiss };
}
