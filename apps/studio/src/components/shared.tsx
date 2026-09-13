import {
  IconAlertCircle,
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowRight,
  IconCompass,
  IconDeviceDesktop,
  IconPlayerPlay,
  IconRefresh,
  IconServer,
  IconX,
} from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

import type {
  CodeFrame as Frame,
  FindingStatus,
  Severity,
} from "../../../../src/studio/types.js";

import { api } from "@/api";
import { SectionHeader } from "@/components/section-header";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefresh } from "@/hooks";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <SectionHeader
      size="lg"
      title={title}
      description={description}
      action={action}
      className="mb-8"
    />
  );
}

export function RuleTag({ id }: { id: string }) {
  return (
    <Badge variant="code" className="font-mono">
      {id}
    </Badge>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  return severity === "error" ? (
    <Badge variant="soft-destructive">
      <IconAlertOctagon className="size-3.5" /> error
    </Badge>
  ) : (
    <Badge variant="soft-warning">
      <IconAlertTriangle className="size-3.5" /> warning
    </Badge>
  );
}

export function StatusPill({ status }: { status: FindingStatus }) {
  if (status === "active") return <Badge variant="soft-danger">new</Badge>;
  if (status === "baselined")
    return <Badge variant="soft-muted">accepted</Badge>;
  return (
    <Badge variant="soft-muted" className="opacity-70">
      suppressed
    </Badge>
  );
}

/**
 * Zones are told apart by material, not hue, matching the boundary strip:
 * the server side is solid, the client side is hatched.
 */
export function ZoneTag({ zone }: { zone: "server" | "client" }) {
  return zone === "server" ? (
    <Badge variant="soft-muted" className="gap-1 font-mono text-[11px]">
      <IconServer className="size-3" /> server
    </Badge>
  ) : (
    <Badge
      variant="soft-muted"
      className="text-foreground/70 relative gap-1 overflow-hidden font-mono text-[11px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 5px)",
        }}
      />
      <IconDeviceDesktop className="relative z-10 size-3" />
      <span className="relative z-10">client</span>
    </Badge>
  );
}

/** The crossing glyph: a value went from the server side to the client side. */
export function Crossing() {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title="Crosses the server → client boundary"
    >
      <ZoneTag zone="server" />
      <IconArrowRight aria-hidden className="text-muted-foreground size-3" />
      <ZoneTag zone="client" />
    </span>
  );
}

/** Funnel tally list representing finding lifecycles: New -> Accepted -> Suppressed */
export function TallyList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative pl-6 py-2", className)}>
      <div className="absolute top-6 bottom-6 left-2 w-px bg-divider-subtle" />
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function TallyRow({
  value,
  label,
  hint,
  tone = "neutral",
}: {
  value: number | ReactNode;
  label: string;
  hint?: string;
  tone?: "neutral" | "danger";
}) {
  const isDanger = tone === "danger" && typeof value === "number" && value > 0;
  return (
    <div className="relative flex items-center gap-4">
      <div
        className={cn(
          "absolute -left-6 top-3 size-2 rounded-full ring-4 ring-background transition-colors",
          isDanger ? "bg-destructive" : "bg-divider-subtle",
        )}
      />
      <div className="grid grid-cols-[4.5rem_1fr] items-baseline gap-4">
        <div
          className={cn(
            "text-stat tabular-nums text-left",
            isDanger ? "text-destructive" : "text-foreground",
          )}
        >
          {value}
        </div>
        <div>
          <div className="text-body-3-sb text-foreground">{label}</div>
          {hint && (
            <div className="text-label-2-m text-muted-foreground">{hint}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A borderless, shadowless stack of rows. */
export function ListPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground divide-divider-subtle divide-y overflow-hidden rounded-huge",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground px-5 py-10 text-center text-sm">
      {children}
    </p>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <ListPanel>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </ListPanel>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-soft flex flex-col items-center rounded-huge px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="bg-card text-muted-foreground flex size-14 items-center justify-center rounded-huge shadow-xs [&_svg]:size-7">
          {icon}
        </div>
      ) : null}
      <p className="mt-4 text-title font-semibold text-foreground">{title}</p>
      {body ? (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-[52ch] text-body-2-r">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  retry,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  retry?: () => void;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "bg-surface-soft flex flex-col items-center rounded-huge px-6 py-16 text-center",
        className,
      )}
    >
      <div className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-huge [&_svg]:size-7">
        <IconAlertTriangle />
      </div>
      <p className="mt-4 text-title font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-[52ch] text-body-2-r">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {retry ? (
          <Button variant="secondary" onClick={retry}>
            <IconRefresh className="mr-2 size-4" />
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function NotFound({
  title = "Page not found",
  description = "The page you are looking for does not exist or has moved.",
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-soft flex flex-col items-center rounded-huge px-6 py-20 text-center",
        className,
      )}
    >
      <div className="bg-card text-muted-foreground flex size-14 items-center justify-center rounded-huge shadow-xs [&_svg]:size-7">
        <IconCompass />
      </div>
      <p className="mt-4 text-title font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-[52ch] text-body-2-r">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {action ?? (
          <Button variant="secondary" asChild>
            <Link href="/">Back to Overview</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function RunScanButton({
  variant = "primary",
  size = "default",
  label = "Run scan",
  className,
}: {
  variant?: "primary" | "secondary";
  size?: "default" | "small";
  label?: string;
  className?: string;
}) {
  const { bump } = useRefresh();
  const [running, setRunning] = useState(false);

  const handleClick = async () => {
    setRunning(true);
    try {
      const result = await api.runScan();
      if (result.findings > 0) {
        toast.error(
          `${result.findings} new finding${result.findings === 1 ? "" : "s"}`,
          {
            description: `${result.baselined} accepted in the baseline, ${result.suppressed} suppressed.`,
          },
        );
      } else {
        toast.success("Nothing new", {
          description: `${result.baselined} accepted in the baseline, ${result.suppressed} suppressed.`,
        });
      }
      bump();
    } catch (error) {
      toast.error("Scan failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <ActionButton
      variant={variant}
      size={size}
      loading={running}
      onClick={handleClick}
      icon={<IconPlayerPlay className="size-4" />}
      className={className}
    >
      {label}
    </ActionButton>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex items-start gap-3 rounded-mid px-4 py-3 text-body-2-m"
    >
      <IconAlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Add-on-Enter chip list — for keywords, pins, ignores, sanitizers. */
export function ChipEditor({
  values,
  onChange,
  placeholder,
  mono = false,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  mono?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const add = () => {
    const next = draft.trim();
    if (!next || values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  };
  return (
    <div className="focus-ring-inset flex flex-wrap items-center gap-2 rounded-mid bg-surface-soft p-2 transition-colors">
      {values.map((value) => (
        <Badge
          key={value}
          variant="secondary"
          className={cn(
            "h-7 gap-1 pr-1 pl-2.5 bg-card text-foreground",
            mono && "font-mono",
          )}
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((entry) => entry !== value))}
            className="text-muted-foreground hover:bg-surface-soft hover:text-foreground rounded-sm p-0.5 cursor-pointer"
          >
            <IconX className="size-3.5" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
          if (event.key === "Backspace" && draft === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className={cn(
          "placeholder:text-muted-foreground h-7 min-w-40 flex-1 border-none bg-transparent px-1.5 text-body-2-m outline-none",
          mono && "font-mono",
        )}
      />
    </div>
  );
}

export function CodeFrame({
  frame,
  line,
  column,
  snippet,
}: {
  frame: Frame;
  line: number;
  column: number;
  snippet: string;
}) {
  const width = String(frame.startLine + frame.lines.length - 1).length;
  const gutter = `${width + 3}ch`;
  return (
    <pre className="bg-surface-soft overflow-x-auto rounded-mid py-3 text-code font-mono leading-6 border-none">
      {frame.lines.map((text, index) => {
        const number = frame.startLine + index;
        const isSink = number === line;
        return (
          <div key={number} className={isSink ? "bg-destructive/10" : ""}>
            <span
              className={cn(
                "inline-block pr-3 text-right select-none",
                isSink
                  ? "text-destructive font-semibold"
                  : "text-muted-foreground",
              )}
              style={{ width: gutter }}
            >
              {number}
            </span>
            <span>{text}</span>
            {isSink ? (
              <div className="text-destructive">
                <span className="inline-block" style={{ width: gutter }} />
                {" ".repeat(Math.max(0, column - 1))}
                {"^".repeat(
                  Math.max(
                    1,
                    Math.min(snippet.length, text.length - column + 1),
                  ),
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </pre>
  );
}
