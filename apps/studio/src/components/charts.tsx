import { IconDeviceDesktop, IconServer } from "@tabler/icons-react";
import { useState } from "react";

import type {
  FindingDetail,
  ScanSummary,
} from "../../../../src/studio/types.js";

import { RuleTag } from "@/components/shared";
import { formatAbsolute } from "@/format";
import { cn } from "@/lib/utils";

export interface Crossing {
  label: string;
  severity: "error" | "warning";
  /** Accepted in the baseline — still on the seam, drawn as a ring. */
  accepted?: boolean;
  /**
   * The finding this dot stands for.
   *
   * Carried so a dot can be opened, not only hovered. The label is enough to
   * read a tooltip from, but the whole point of the seam is to get from "42
   * things crossed" to the code that crossed — which needs the finding itself.
   */
  finding: FindingDetail;
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
  sensitiveFields,
  schemaFields,
  onOpenFinding,
}: {
  serverFiles: number;
  clientFiles: number;
  crossings: Crossing[];
  sensitiveFields?: number;
  schemaFields?: number;
  onOpenFinding?: (finding: FindingDetail) => void;
}) {
  const total = Math.max(1, serverFiles + clientFiles);
  const seam = Math.min(80, Math.max(20, (serverFiles / total) * 100));
  const [hover, setHover] = useState<number | null>(null);
  const fresh = crossings.filter((c) => !c.accepted).length;
  const accepted = crossings.length - fresh;

  /*
   * Dot layout.
   *
   * Every crossing keeps its own dot — no clustering, no "+38 more" — so the
   * seam stays a literal count of what crossed. But 160px of seam holding 42
   * dots puts them 3px apart: a smear you can neither hover nor click, which
   * is exactly what the red cluster on the seam had become. So the dots fan
   * into lanes either side of the line and the strip grows to fit the rows
   * that result. More crossings give a taller seam rather than a denser one.
   *
   * Row pitch equals lane pitch (22px) and each target is 20px square, so no
   * two dots overlap and every one of them is reachable. The visual dot inside
   * each target stays 14px, so the seam still reads as a thin thread and not
   * as a wall of buttons.
   *
   * The lane count steps rather than scaling: fanning three dots across five
   * lanes would look like scatter, so a short seam stays one clean column.
   */
  const LANES =
    crossings.length <= 6
      ? [0]
      : crossings.length <= 16
        ? [0, -11, 11]
        : [0, -11, 11, -22, 22];
  const ROW = 22;
  const rows = Math.ceil(crossings.length / LANES.length);
  const height = Math.max(160, rows * ROW + 36);

  return (
    <figure className="relative">
      <div
        className="relative flex overflow-hidden rounded-huge"
        style={{ height }}
      >
        {/* Server slab: solid filled */}
        <div
          className="bg-primary text-primary-foreground flex flex-col justify-between p-3 select-none sm:p-6"
          style={{ width: `${seam}%` }}
        >
          {/* The seam can be as narrow as a fifth of a phone's width, and the
              word does not fit in that. The icon and the solid-versus-hatched
              material still say which side is which. */}
          <span className="inline-flex items-center gap-1.5 text-label-3-m opacity-90">
            <IconServer className="size-4 shrink-0" />
            <span className="hidden sm:inline">Server</span>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-cal text-[24px] leading-none font-semibold tabular-nums sm:text-[40px]">
              {serverFiles}
            </span>
            <span className="text-body-2-r hidden opacity-80 sm:inline">
              files
            </span>
          </span>
        </div>

        {/* Client side: surface soft + diagonal subtle hatch */}
        <div className="bg-surface-soft relative flex flex-1 flex-col items-end justify-between overflow-hidden p-3 text-right select-none sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 6px)",
            }}
          />
          <span className="text-muted-foreground relative z-10 inline-flex items-center gap-1.5 text-label-3-m">
            Client <IconDeviceDesktop className="size-4" />
          </span>
          <span className="relative z-10 flex items-baseline gap-2">
            <span className="font-cal text-foreground text-[24px] leading-none font-semibold tabular-nums sm:text-[40px]">
              {clientFiles}
            </span>
            <span className="text-muted-foreground text-body-2-r">files</span>
          </span>
        </div>

        {/* The Seam: 2px line - red when violations crossed, neutral otherwise */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 w-0.5 z-20 transition-colors",
            fresh > 0 ? "bg-destructive" : "bg-foreground/25",
          )}
          style={{ left: `calc(${seam}% - 1px)` }}
        />

        {/* Crossing dots */}
        {crossings.map((crossing, index) => {
          const row = Math.floor(index / LANES.length);
          const dx = LANES[index % LANES.length];
          const top = (height - rows * ROW) / 2 + row * ROW + ROW / 2;
          const fill = crossing.accepted
            ? "bg-card border-muted-foreground/60"
            : crossing.severity === "error"
              ? "bg-destructive border-background"
              : "bg-warning border-background";
          return (
            <button
              key={index}
              type="button"
              aria-label={crossing.label}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              onClick={() => onOpenFinding?.(crossing.finding)}
              className="focus-ring group absolute z-30 flex size-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full focus-visible:z-40"
              style={{ left: `calc(${seam}% + ${dx}px)`, top }}
            >
              {/* The visible dot is smaller than the button around it: the seam
                  keeps its thin-thread look, the target keeps its 20px. */}
              <span
                className={cn(
                  "pointer-events-none size-3.5 rounded-full border-2 transition-transform duration-150 group-hover:scale-125 group-focus-visible:scale-125",
                  fill,
                )}
              />
            </button>
          );
        })}
      </div>

      {hover !== null && crossings[hover] ? (
        <div
          role="tooltip"
          className="bg-foreground text-background pointer-events-none absolute -top-2 left-1/2 max-w-[60ch] -translate-x-1/2 -translate-y-full rounded-mid px-3 py-1.5 text-xs z-40"
        >
          {crossings[hover].accepted ? "Accepted: " : ""}
          {crossings[hover].label}
        </div>
      ) : null}

      <figcaption className="text-muted-foreground mt-3 text-body-2-r">
        {crossings.length === 0
          ? "Nothing crosses the boundary."
          : fresh === 0
            ? `Nothing new. ${accepted} crossing${accepted === 1 ? "" : "s"} accepted in the baseline (marked on the seam).`
            : `${fresh} value${fresh === 1 ? "" : "s"} crossed into client components${
                accepted > 0 ? `, and ${accepted} accepted earlier` : ""
              }.`}
        {sensitiveFields !== undefined && schemaFields !== undefined
          ? ` ${sensitiveFields} of ${schemaFields} schema fields are sensitive.`
          : ""}
        {/* Only when there is something to open, and only when the caller wired
            a handler — the dots are inert without one, and a caption promising a
            click that does nothing is worse than no caption. */}
        {crossings.length > 0 && onOpenFinding
          ? " Each dot on the seam opens its finding."
          : ""}
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
          <div className="bg-surface-soft flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            <div
              className="bg-foreground/85 h-full rounded-full transition-all"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
            {row.accepted > 0 ? (
              <div
                className="bg-foreground/25 h-full rounded-full transition-all"
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
          stroke="var(--divider-subtle)"
        />
        <line
          x1={padX}
          x2={W - padX}
          y1={y(max)}
          y2={y(max)}
          stroke="var(--divider-subtle)"
          strokeDasharray="2 4"
        />
        <text
          x={padX}
          y={padTop - 10}
          className="fill-muted-foreground text-[10px] font-mono"
        >
          {max} new
        </text>
        <path d={area} fill="var(--foreground)" opacity={0.05} />
        <path
          d={path}
          fill="none"
          stroke="var(--foreground)"
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
              fill="var(--foreground)"
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
          className="bg-card text-foreground pointer-events-none absolute top-0 rounded-mid px-3 py-1.5 text-label-2-m"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <span className="font-semibold tabular-nums">{active.findings}</span>{" "}
          new, {active.baselined} accepted on {formatAbsolute(active.startedAt)}
        </div>
      ) : null}
    </div>
  );
}
