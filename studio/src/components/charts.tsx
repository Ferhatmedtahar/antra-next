import { IconDeviceDesktop, IconServer } from "@tabler/icons-react";
import { useState } from "react";

import type { ScanSummary } from "../../../src/studio/types.js";

import { RuleTag } from "@/components/shared";
import { formatAbsolute } from "@/format";
import { cn } from "@/lib/utils";

export interface Crossing {
  label: string;
  severity: "error" | "warning";
  /** Accepted in the baseline — still on the seam, drawn as a ring. */
  accepted?: boolean;
}

/**
 * The hero: the boundary itself. Server files on the left, client files on
 * the right, proportional; every server→client crossing the rules flagged is
 * a dot on the seam — solid when new, a ring when already accepted.
 */
export function BoundaryStrip({
  serverFiles,
  clientFiles,
  crossings,
}: {
  serverFiles: number;
  clientFiles: number;
  crossings: Crossing[];
}) {
  const total = Math.max(1, serverFiles + clientFiles);
  // Keep both blocks readable even when one side dominates.
  const seam = Math.min(80, Math.max(20, (serverFiles / total) * 100));
  const [hover, setHover] = useState<number | null>(null);
  const fresh = crossings.filter((c) => !c.accepted).length;
  const accepted = crossings.length - fresh;

  return (
    <figure className="relative">
      <div className="relative flex h-36 overflow-hidden rounded-xl border shadow-sm">
        <div
          className="bg-primary text-primary-foreground flex flex-col justify-between p-5"
          style={{ width: `${seam}%` }}
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium opacity-90">
            <IconServer className="size-4" /> Server
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-4xl leading-none font-semibold tabular-nums">
              {serverFiles}
            </span>
            <span className="text-sm opacity-90">files</span>
          </span>
        </div>
        <div className="bg-muted flex flex-1 flex-col items-end justify-between p-5 text-right">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
            Client <IconDeviceDesktop className="size-4" />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-4xl leading-none font-semibold tabular-nums">
              {clientFiles}
            </span>
            <span className="text-muted-foreground text-sm">files</span>
          </span>
        </div>
        <div
          aria-hidden
          className="bg-foreground absolute inset-y-0 w-0.5"
          style={{ left: `calc(${seam}% - 1px)` }}
        />
        {crossings.map((crossing, index) => {
          const top =
            crossings.length === 1
              ? 50
              : 12 + (index / (crossings.length - 1)) * 76;
          const fill = crossing.accepted
            ? "bg-card border-muted-foreground"
            : crossing.severity === "error"
              ? "bg-destructive border-card"
              : "bg-warning border-card";
          return (
            <button
              key={index}
              type="button"
              aria-label={crossing.label}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              className={cn(
                "absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm",
                fill,
              )}
              style={{ left: `${seam}%`, top: `${top}%` }}
            />
          );
        })}
      </div>
      {hover !== null && crossings[hover] ? (
        <div
          role="tooltip"
          className="bg-foreground text-background pointer-events-none absolute -top-2 left-1/2 max-w-[60ch] -translate-x-1/2 -translate-y-full rounded-md px-3 py-1.5 text-xs shadow-md"
        >
          {crossings[hover].accepted ? "Accepted · " : ""}
          {crossings[hover].label}
        </div>
      ) : null}
      <figcaption className="text-muted-foreground mt-3 text-sm">
        {crossings.length === 0
          ? "Nothing crosses the boundary."
          : fresh === 0
            ? `Nothing new. ${accepted} crossing${accepted === 1 ? "" : "s"} accepted in the baseline — the rings on the seam.`
            : `${fresh} new crossing${fresh === 1 ? "" : "s"} flagged on the seam${
                accepted > 0 ? `, ${accepted} accepted earlier (rings)` : ""
              }.`}
      </figcaption>
    </figure>
  );
}

/** Single-hue horizontal bars, direct-labelled — magnitude only, no legend needed. */
export function RuleBars({
  rows,
}: {
  rows: { id: string; description: string; count: number; accepted: number }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.count + row.accepted));
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <RuleTag id={row.id} />
              <span className="text-muted-foreground truncate text-xs">
                {row.description}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {row.count}
              {row.accepted > 0 ? (
                <span className="text-muted-foreground ml-1 font-normal">
                  / {row.accepted}
                </span>
              ) : null}
            </span>
          </div>
          <div className="bg-muted flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
            {row.accepted > 0 ? (
              <div
                className="bg-primary/30 h-full rounded-full"
                style={{ width: `${(row.accepted / max) * 100}%` }}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** New findings per scan — one series, 2px line, 8px markers, hover crosshair + tooltip. */
export function TrendLine({ scans }: { scans: ScanSummary[] }) {
  const points = [...scans].reverse();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        The trend appears after a second scan — run one whenever the code or the
        config changes.
      </p>
    );
  }
  const W = 640;
  const H = 180;
  const padX = 12;
  const padTop = 28;
  const padBottom = 28;
  const max = Math.max(1, ...points.map((scan) => scan.findings));
  const x = (i: number) => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = (value: number) =>
    padTop + (1 - value / max) * (H - padTop - padBottom);
  const path = points
    .map((scan, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(scan.findings)}`)
    .join(" ");
  const area = `${path} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const active = hover !== null ? points[hover] : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full"
        role="img"
        aria-label={`New findings across ${points.length} scans`}
        onMouseLeave={() => setHover(null)}
      >
        <line
          x1={padX}
          x2={W - padX}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--border)"
        />
        <line
          x1={padX}
          x2={W - padX}
          y1={y(max)}
          y2={y(max)}
          stroke="var(--border)"
          strokeDasharray="2 4"
        />
        <text
          x={padX}
          y={padTop - 10}
          className="fill-muted-foreground text-[10px]"
        >
          {max} new
        </text>
        <path d={area} fill="var(--primary)" opacity={0.08} />
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((scan, i) => (
          <g key={scan.id}>
            <rect
              x={x(i) - W / points.length / 2}
              y={0}
              width={W / points.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {hover === i ? (
              <line
                x1={x(i)}
                x2={x(i)}
                y1={padTop}
                y2={y(0)}
                stroke="var(--muted-foreground)"
                strokeDasharray="2 3"
              />
            ) : null}
            <circle
              cx={x(i)}
              cy={y(scan.findings)}
              r={hover === i ? 5 : 4}
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          </g>
        ))}
        <text x={padX} y={H - 8} className="fill-muted-foreground text-[10px]">
          {formatAbsolute(points[0]?.startedAt ?? "")}
        </text>
        <text
          x={W - padX}
          y={H - 8}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {formatAbsolute(points[points.length - 1]?.startedAt ?? "")}
        </text>
      </svg>
      {active && hover !== null ? (
        <div
          role="tooltip"
          className="bg-foreground text-background pointer-events-none absolute top-0 rounded-md px-3 py-1.5 text-xs shadow-md"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="font-semibold tabular-nums">{active.findings}</span>{" "}
          new · {active.baselined} baselined ·{" "}
          {formatAbsolute(active.startedAt)}
        </div>
      ) : null}
    </div>
  );
}
