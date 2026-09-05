import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
} from "@tabler/icons-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";

import type { RouteFile } from "@/components/graph/route-tree";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const ROUTE_NODE_WIDTH = 220;
export const ROUTE_NODE_HEIGHT = 72;

export interface RouteNodeData extends Record<string, unknown> {
  segment: string;
  href: string;
  files: RouteFile[];
  /** Direct children in the tree; 0 for a leaf. */
  children: number;
  expanded: boolean;
}

export type RouteFlowNode = Node<RouteNodeData, "route">;

function chipFor(file: RouteFile) {
  if (file.name === "route") {
    return (
      <Badge
        key={file.name}
        variant="soft-muted"
        className="h-4 px-1.5 text-[9px]"
      >
        route {file.methods.join(" ")}
      </Badge>
    );
  }
  if (file.name === "page" || file.name === "layout") {
    return (
      <Badge
        key={file.name}
        variant={file.boundary === "client" ? "soft-warning" : "soft-muted"}
        className="h-4 px-1.5 text-[9px]"
      >
        {file.name}
      </Badge>
    );
  }
  return (
    <Badge
      key={file.name}
      variant="soft-muted"
      className="h-4 px-1.5 text-[9px]"
    >
      {file.name}
    </Badge>
  );
}

function RouteNodeView({ data, selected }: NodeProps<RouteFlowNode>) {
  const isGroup = data.segment.startsWith("(");
  const isDynamic = data.segment.startsWith("[");
  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-1.5 rounded-mid px-3 py-2 transition-all",
        selected && "ring-2 ring-tertiary-500",
        data.children > 0 && "cursor-pointer",
      )}
      style={{ width: ROUTE_NODE_WIDTH, minHeight: ROUTE_NODE_HEIGHT }}
      title={data.href}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground/30 !size-2 !border-0"
      />
      <div className="flex items-center gap-2">
        <IconFolder
          className={cn(
            "size-4 shrink-0",
            isDynamic
              ? "text-warning"
              : isGroup
                ? "text-muted-foreground"
                : "text-foreground",
          )}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">
          {data.segment}
        </span>
        {data.children > 0 ? (
          <span className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums">
            {data.expanded ? (
              <IconChevronDown className="size-3.5" />
            ) : (
              <>
                {data.children}
                <IconChevronRight className="size-3.5" />
              </>
            )}
          </span>
        ) : null}
      </div>
      <div className="text-muted-foreground truncate font-mono text-[10px]">
        {data.href}
      </div>
      <div className="flex flex-wrap gap-1">{data.files.map(chipFor)}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground/30 !size-2 !border-0"
      />
    </div>
  );
}

export const RouteNode = memo(RouteNodeView);
