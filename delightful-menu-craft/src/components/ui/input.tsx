import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[var(--aio-r-2)] border border-input bg-surface px-3 py-2 text-base text-ink transition-[border-color,box-shadow] duration-[200ms] ease-aio file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-faint hover:border-rule-2 focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-[var(--aio-focus-ring)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60 md:text-[13px]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
