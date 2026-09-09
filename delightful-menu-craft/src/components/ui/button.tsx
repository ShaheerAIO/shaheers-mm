import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * AIO console button language: 12px radius, semibold 13px label, a 1px edge on
 * every variant, a 1px tactile press, and soft (washed) rather than filled reds.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-[13px] font-semibold transition-[background-color,border-color,color,transform,opacity] duration-[140ms] ease-aio active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 motion-reduce:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-primary hover:bg-[var(--aio-accent-h)] hover:border-[var(--aio-accent-h)]",
        destructive: "bg-danger-bg text-danger border-danger-edge hover:bg-danger-bg hover:border-danger",
        outline: "bg-surface text-ink-2 border-rule font-medium hover:border-ink-2 hover:text-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-3",
        ghost: "text-ink-muted hover:bg-accent hover:text-accent-foreground",
        link: "text-[var(--aio-accent-text)] underline-offset-4 hover:underline hover:text-[var(--aio-accent-h)]",
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
