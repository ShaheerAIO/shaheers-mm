import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface BulkOp {
  /** e.g. "6 items" */
  scope: string;
  /** e.g. "price +% 10" */
  label: string;
  /** level accent color */
  color: string;
}

interface BulkReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ops: BulkOp[];
  reachSummary: string;
  warnings: string[];
  onConfirm: () => void;
}

export function BulkReviewModal({
  open,
  onOpenChange,
  ops,
  reachSummary,
  warnings,
  onConfirm,
}: BulkReviewModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Review changes before applying</AlertDialogTitle>
          <AlertDialogDescription>
            These edits — including cascaded changes — will be applied to {reachSummary}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[40vh] overflow-y-auto space-y-1.5">
          {ops.map((op, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: op.color }} />
              <span className="font-semibold shrink-0">{op.scope}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground">{op.label}</span>
            </div>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="flex gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''}:
              </p>
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Apply {ops.length} change{ops.length !== 1 ? 's' : ''}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
