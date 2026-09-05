import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  /** Bare 16px muted icon inline before the title. Opt-in, `sm` only. */
  glyph?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  action?: ReactNode;
  /** `sm` heads a card; `lg` heads a page. */
  size?: "sm" | "lg";
}

/** Clean title + description, with optional inline glyph and optional action on the right. */
export function SectionHeader({
  glyph,
  title,
  description,
  className,
  action,
  size = "sm",
}: Readonly<SectionHeaderProps>) {
  const large = size === "lg";
  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        {title ? (
          <div className="flex items-center gap-2">
            {!large && glyph ? (
              <span className="text-muted-foreground size-4 shrink-0 [&_svg]:size-4">
                {glyph}
              </span>
            ) : null}
            {large ? (
              <h1 className="text-display text-foreground">{title}</h1>
            ) : (
              <h3 className="text-title text-foreground">{title}</h3>
            )}
          </div>
        ) : null}
        {description ? (
          <p className="text-body-2-r text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
