import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * AIO button language (aio-design-system §10): 10px radius, weight 500, a 1px
 * edge on every variant, no elevation and no transform. Destructive is the
 * brand coral — red is reserved for validation feedback.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--aio-r-btn)] border border-transparent text-[13px] font-medium transition-[background-color,border-color,color,opacity] duration-[250ms] ease-aio focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-primary hover:bg-[var(--aio-accent-h)] hover:border-[var(--aio-accent-h)]",
        destructive:
          "bg-primary text-primary-foreground border-primary hover:bg-[var(--aio-accent-h)] hover:border-[var(--aio-accent-h)]",
        outline: "bg-transparent text-[var(--aio-accent)] border-[var(--aio-accent)] hover:bg-[var(--aio-hover)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-3",
        // `ghost` is this codebase's neutral icon affordance (close, chevrons, row
        // actions), not the skill's coral `tertiary` — it stays neutral.
        ghost: "text-ink-muted hover:bg-[var(--aio-row-hover)] hover:text-ink",
        link: "text-[var(--aio-accent)] underline-offset-4 hover:underline hover:text-[var(--aio-accent-h)]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
