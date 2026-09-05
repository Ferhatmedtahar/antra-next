import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none overflow-hidden transition-colors duration-150 shrink-0 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 rounded-big whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "bg-transparent hover:bg-surface-soft text-foreground",
        secondary: "bg-surface-soft text-foreground hover:bg-surface-soft/80",
        ghost: "bg-transparent text-foreground hover:bg-surface-soft",
        blue: "bg-tertiary-500 text-white hover:bg-tertiary-600",
        icon: "bg-card text-foreground rounded-icon aspect-square hover:bg-surface-soft",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 text-sm gap-2",
        sm: "h-8 px-3 text-xs gap-1.5",
        md: "h-10 px-4 text-sm gap-2",
        lg: "h-12 px-6 text-sm gap-2",
        icon: "size-10 rounded-icon p-0",
        "icon-sm": "size-8 rounded-icon p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
