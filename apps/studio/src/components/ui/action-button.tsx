import { IconLoader2 } from "@tabler/icons-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "blue" | "danger" | "ghost";
  size?: "default" | "small";
  icon?: ReactNode;
  loading?: boolean;
}

export function ActionButton({
  variant = "primary",
  size = "default",
  icon,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const isSmall = size === "small";
  const heightClass = isSmall ? "h-10" : "h-12";
  const iconRadiusClass = isSmall ? "rounded-mid" : "rounded-icon";
  const rightIconBoxClass = isSmall
    ? "h-7 w-7 right-1.5 [&_svg]:size-3.5"
    : "h-9 w-9 right-1.5 [&_svg]:size-4";
  const textClass = isSmall
    ? "text-label-2-m font-semibold pr-9"
    : "text-label-3-sb pr-11";

  const variants = {
    primary: "w-full bg-primary text-primary-foreground hover:bg-primary/90",
    blue: "w-full bg-tertiary-500 text-white hover:bg-tertiary-600",
    secondary:
      "w-full bg-surface-soft text-foreground hover:bg-surface-soft/80",
    danger: "w-full bg-destructive text-white hover:bg-destructive/90",
    ghost: "w-full bg-transparent text-foreground hover:bg-surface-soft",
  };

  const iconBg = {
    primary: "bg-card text-foreground",
    blue: "bg-white text-tertiary-600",
    secondary: "bg-card text-foreground",
    danger: "bg-white text-destructive",
    ghost: "bg-card text-foreground",
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "group relative inline-flex w-full items-center justify-start rounded-big px-4 transition-colors font-medium focus-ring cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden select-none",
        heightClass,
        variants[variant],
        loading && "opacity-80",
        className,
      )}
      {...props}
    >
      <span className={cn("truncate", textClass)}>{children}</span>
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors shrink-0",
          iconRadiusClass,
          rightIconBoxClass,
          iconBg,
        )}
      >
        {loading ? (
          <IconLoader2 className="size-3.5 animate-spin text-inherit" />
        ) : (
          icon
        )}
      </div>
    </button>
  );
}
