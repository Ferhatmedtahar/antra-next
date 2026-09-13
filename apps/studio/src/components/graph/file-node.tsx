import {
  IconBolt,
  IconDeviceDesktop,
  IconRoute,
  IconServer,
} from "@tabler/icons-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo, type ReactNode } from "react";

import type { GraphNodeKind } from "../../../../../src/studio/types.js";

import type { Direction } from "@/components/graph/layout";
import { cn } from "@/lib/utils";

export const NODE_WIDTH = 236;
export const NODE_HEIGHT = 56;

export interface FileNodeData extends Record<string, unknown> {
  path: string;
  kind: GraphNodeKind;
  findings: number;
  newFindings: number;
  serverActions: string[];
  routeMethods: string[];
  dimmed: boolean;
  focused: boolean;
  direction: Direction;
}

export type FileFlowNode = Node<FileNodeData, "file">;

export const KIND_STYLE: Record<
  GraphNodeKind,
  { label: string; short: string; icon: ReactNode; color: string }
> = {
  server: {
    label: "Server component",
    short: "server",
    icon: <IconServer className="size-4" />,
    color: "var(--foreground)",
  },
  client: {
    label: "Client component",
    short: "client",
    icon: <IconDeviceDesktop className="size-4" />,
    color: "var(--muted-foreground)",
  },
  action: {
    label: "Server actions",
    short: "actions",
    icon: <IconBolt className="size-4" />,
    color: "var(--foreground)",
  },
  route: {
    label: "Route handler",
    short: "route",
    icon: <IconRoute className="size-4" />,
    color: "var(--muted-foreground)",
  },
};

/**
 * The client side of the boundary is hatched, exactly as in the boundary
 * strip. Material rather than hue, so the only colour on this canvas is a
 * finding.
 */
const HATCH =
  "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 6px)";

export function splitPath(path: string): { dir: string; base: string } {
  const at = path.lastIndexOf("/");
  return at === -1
    ? { dir: "", base: path }
    : { dir: path.slice(0, at), base: path.slice(at + 1) };
}

function FileNodeView({ data, selected }: NodeProps<FileFlowNode>) {
  const { dir, base } = splitPath(data.path);
  const style = KIND_STYLE[data.kind];
  const horizontal = data.direction === "LR";
  return (
    <div
      className={cn(
        "bg-card text-card-foreground relative flex items-center gap-2.5 overflow-hidden rounded-mid px-3 py-2 shadow-none transition-all",
        data.dimmed && "opacity-20",
        (selected || data.focused) && "ring-2 ring-tertiary-500",
      )}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      title={data.path}
    >
      {data.kind === "client" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: HATCH }}
        />
      ) : null}
      <Handle
        type="target"
        position={horizontal ? Position.Left : Position.Top}
        className="!bg-muted-foreground/30 !size-2 !border-0"
      />
      <div className="bg-surface-soft text-muted-foreground relative z-10 flex size-8 shrink-0 items-center justify-center rounded-icon">
        {style.icon}
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold">{base}</span>
          <span className="bg-surface-soft text-muted-foreground text-label-2-m shrink-0 rounded-xs px-1 py-0.5">
            {style.short}
          </span>
        </div>
        <div className="text-muted-foreground truncate font-mono text-[10px]">
          {dir || "."}
        </div>
      </div>
      {data.findings > 0 ? (
        <span
          className={cn(
            "relative z-10 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            data.newFindings > 0
              ? "bg-destructive text-white"
              : "bg-muted text-muted-foreground",
          )}
          title={`${data.findings} finding(s), ${data.newFindings} new`}
        >
          {data.findings}
        </span>
      ) : null}
      <Handle
        type="source"
        position={horizontal ? Position.Right : Position.Bottom}
        className="!bg-muted-foreground/30 !size-2 !border-0"
      />
    </div>
  );
}

export const FileNode = memo(FileNodeView);
