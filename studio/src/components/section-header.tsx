import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  iconClassName?: string;
  action?: ReactNode;
  /** `sm` heads a card; `lg` heads a page. */
  size?: "sm" | "lg";
}

function SectionHeaderIcon({
  icon,
  className,
}: {
  icon: ReactNode;
  className: string;
}) {
  if (isValidElement(icon)) {
    const existing = (icon.props as { className?: string }).className ?? "";
    return cloneElement(icon as ReactElement<SVGProps<SVGSVGElement>>, {
      className: cn(className, existing),
    });
  }
  return icon;
}

/** Icon tile + title + description, with an optional action on the right. */
export function SectionHeader({
  icon,
  title,
  description,
  className,
  iconClassName,
  action,
  size = "sm",
}: Readonly<SectionHeaderProps>) {
  const large = size === "lg";
  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center justify-between gap-3 sm:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-row items-center gap-3 sm:gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center",
            large
              ? "bg-primary text-primary-foreground size-12 rounded-xl shadow-sm"
              : "bg-primary/10 text-primary size-10 rounded-lg",
            iconClassName,
          )}
        >
          <SectionHeaderIcon
            icon={icon}
            className={large ? "size-6" : "size-5"}
          />
        </div>

        {title || description ? (
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 sm:gap-0.5">
            {title ? (
              large ? (
                <h1 className="text-2xl leading-tight font-semibold tracking-tight">
                  {title}
                </h1>
              ) : (
                <h3 className="text-sm leading-snug font-semibold">{title}</h3>
              )
            ) : null}
            {description ? (
              <p
                className={cn(
                  "text-muted-foreground leading-normal",
                  large ? "text-sm" : "text-xs",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
