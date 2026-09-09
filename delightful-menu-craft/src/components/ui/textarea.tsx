import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[var(--aio-r-2)] border border-[var(--aio-border)] bg-surface px-3 py-2 text-[13px] leading-normal text-ink transition-[border-color,box-shadow] duration-[140ms] ease-aio placeholder:text-ink-faint hover:border-rule-2 focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-[var(--aio-focus-ring)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
