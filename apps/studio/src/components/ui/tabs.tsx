import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: "default" | "underline";
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        variant === "underline"
          ? "inline-flex h-10 w-fit items-center gap-6 bg-transparent p-0"
          : "bg-surface-soft text-muted-foreground inline-flex h-10 w-fit items-center justify-center rounded-big p-1",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        "group-data-[variant=underline]/tabs-list:relative group-data-[variant=underline]/tabs-list:h-10 group-data-[variant=underline]/tabs-list:px-1 group-data-[variant=underline]/tabs-list:text-muted-foreground group-data-[variant=underline]/tabs-list:hover:text-foreground group-data-[variant=underline]/tabs-list:data-[state=active]:text-foreground",
        "in-data-[variant=underline]:relative in-data-[variant=underline]:h-10 in-data-[variant=underline]:px-1 in-data-[variant=underline]:text-muted-foreground in-data-[variant=underline]:hover:text-foreground in-data-[variant=underline]:data-[state=active]:text-foreground in-data-[variant=underline]:after:absolute in-data-[variant=underline]:after:bottom-0 in-data-[variant=underline]:after:left-0 in-data-[variant=underline]:after:right-0 in-data-[variant=underline]:after:h-0.5 in-data-[variant=underline]:after:bg-transparent in-data-[variant=underline]:data-[state=active]:after:bg-foreground",
        "not-in-data-[variant=underline]:h-8 not-in-data-[variant=underline]:rounded-mid not-in-data-[variant=underline]:px-3 not-in-data-[variant=underline]:data-[state=active]:bg-card not-in-data-[variant=underline]:data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
