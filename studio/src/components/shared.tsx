import {
  IconAlertCircle,
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowRight,
  IconDeviceDesktop,
  IconServer,
  IconX,
} from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";

import type {
  CodeFrame as Frame,
  FindingStatus,
  Severity,
} from "../../../src/studio/types.js";

import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <SectionHeader
      size="lg"
      icon={icon}
      title={title}
      description={description}
      action={action}
      className="mb-8"
    />
  );
}

export function RuleTag({ id }: { id: string }) {
  return (
    <Badge variant="soft-primary" className="font-mono">
      {id}
    </Badge>
  );
}

export function SeverityPill({ severity }: { severity: Severity }) {
  return severity === "error" ? (
    <Badge variant="soft-destructive">
      <IconAlertOctagon /> error
    </Badge>
  ) : (
    <Badge variant="soft-warning">
      <IconAlertTriangle /> warning
    </Badge>
  );
}

export function StatusPill({ status }: { status: FindingStatus }) {
  if (status === "active") return <Badge variant="destructive">new</Badge>;
  if (status === "baselined")
    return <Badge variant="soft-muted">accepted</Badge>;
  return <Badge variant="soft-success">suppressed</Badge>;
}

export function ZoneTag({ zone }: { zone: "server" | "client" }) {
  return zone === "server" ? (
    <Badge variant="soft-primary" className="gap-1">
      <IconServer /> server
    </Badge>
  ) : (
    <Badge variant="soft-warning" className="gap-1">
      <IconDeviceDesktop /> client
    </Badge>
  );
}

/** The crossing glyph: a value went from the server side to the client side. */
export function Crossing() {
  return (
    <span
      className="inline-flex items-center gap-1"
      title="Crosses the server → client boundary"
    >
      <ZoneTag zone="server" />
      <IconArrowRight aria-hidden className="text-muted-foreground size-3.5" />
      <ZoneTag zone="client" />
    </span>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "danger" | "good";
}) {
  const tile = {
    neutral: "bg-primary/10 text-primary",
    danger: "bg-destructive/10 text-destructive",
    good: "bg-success/12 text-success",
  }[tone];
  return (
    <Card className="gap-4 py-5">
      <CardContent className="px-5">
        <SectionHeader icon={icon} iconClassName={tile} title={label} />
        <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {hint ? (
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** A bordered stack of rows — the replacement for tables. */
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
        "bg-card text-card-foreground divide-border divide-y overflow-hidden rounded-xl border shadow-sm",
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
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="bg-card/50 flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl [&_svg]:size-6">
        {icon}
      </div>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-[52ch] text-sm">
        {body}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
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
    <div className="border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex flex-wrap items-center gap-2 rounded-lg border bg-transparent p-2 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]">
      {values.map((value) => (
        <Badge
          key={value}
          variant="secondary"
          className={cn("h-7 gap-1 pr-1 pl-2.5 text-sm", mono && "font-mono")}
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((entry) => entry !== value))}
            className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground rounded-sm p-0.5"
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
          "placeholder:text-muted-foreground h-7 min-w-40 flex-1 bg-transparent px-1.5 text-sm outline-none",
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
    <pre className="bg-muted/60 overflow-x-auto rounded-lg border py-2 font-mono text-[13px] leading-6">
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
