import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-mid px-2.5 py-0.5 text-label-2-m font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-surface-soft text-foreground",
        destructive: "bg-destructive text-white",
        outline: "bg-transparent text-foreground",
        "soft-danger": "bg-destructive/12 text-destructive",
        "soft-destructive": "bg-destructive/12 text-destructive",
        "soft-warn": "bg-warning/14 text-warning",
        "soft-warning": "bg-warning/14 text-warning",
        "soft-good": "bg-success/12 text-success",
        "soft-success": "bg-success/12 text-success",
        "soft-muted": "bg-surface-soft text-muted-foreground",
        code: "bg-surface-soft text-muted-foreground font-mono text-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
