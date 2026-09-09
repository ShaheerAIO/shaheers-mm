import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill border border-transparent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[var(--aio-accent-soft)] text-[var(--aio-accent-text)]",
        secondary: "bg-surface-3 text-ink-muted",
        destructive: "bg-danger-bg text-danger",
        outline: "border-rule bg-surface text-ink-2",
        ok: "bg-ok-bg text-ok",
        warn: "bg-warn-bg text-warn",
        info: "bg-[var(--aio-info-bg)] text-[var(--aio-info)]",
        active: "bg-accent2-soft text-accent2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
