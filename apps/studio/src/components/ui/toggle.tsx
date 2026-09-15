import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-mid font-mono text-[12px] font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-ring whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        default:
          "bg-surface-soft text-muted-foreground hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
        chips:
          // A filter chip is a query term, not a call to action. Filling it
          // with `primary` made a row of active filters read as a row of
          // primary buttons, so on-state is the quiet surface fill the rest of
          // the app uses for a selected-but-secondary thing.
          "bg-transparent text-muted-foreground hover:bg-surface-soft hover:text-foreground data-[state=on]:bg-surface-soft data-[state=on]:text-foreground",
        outline:
          "bg-surface-soft text-muted-foreground hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
      },
      size: {
        default: "h-8 px-3 min-w-8",
        sm: "h-7 px-2 min-w-7 text-[11px]",
        lg: "h-9 px-3.5 min-w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
