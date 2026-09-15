import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconChartDots3,
  IconFocus2,
  IconHierarchy,
  IconInfoCircle,
  IconSitemap,
  IconX,
} from "@tabler/icons-react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearch } from "wouter";

import type {
  FileDetail,
  FindingDetail,
  GraphEdge,
  GraphNode,
  GraphResponse,
  ProjectInfo,
} from "../../../../src/studio/types.js";

import { api } from "@/api";
import { FindingSheet } from "@/components/finding-sheet";
import {
  CANVAS,
  CANVAS_FULLSCREEN,
  FullscreenButton,
  useFullscreen,
} from "@/components/graph/canvas";
import {
  FileNode,
  KIND_STYLE,
  NODE_HEIGHT,
  NODE_WIDTH,
  splitPath,
  type FileFlowNode,
} from "@/components/graph/file-node";
import { layoutDagre } from "@/components/graph/layout";
import { layoutForce } from "@/components/graph/layout-force";
import {
  ROUTE_NODE_HEIGHT,
  ROUTE_NODE_WIDTH,
  RouteNode,
  type RouteFlowNode,
} from "@/components/graph/route-node";
import {
  buildRouteTree,
  type RouteSegment,
} from "@/components/graph/route-tree";
import { SectionHeader } from "@/components/section-header";
import {
  Empty,
  ErrorNote,
  ErrorState,
  PageHeader,
  RuleTag,
  RunScanButton,
  StatusPill,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLoad, useTheme } from "@/hooks";
import { cn } from "@/lib/utils";

type View = "graph" | "routes";
type LayoutMode = "force" | "LR" | "TB";

interface Filters {
  crossingsOnly: boolean;
  findingsOnly: boolean;
  actions: boolean;
  hideIsolated: boolean;
}

const nodeTypes = { file: FileNode, route: RouteNode };

function edgeColor(edge: GraphEdge): string {
  if (edge.newFindings > 0) return "var(--destructive)";
  if (edge.findings > 0) return "var(--warning)";
  return "var(--muted-foreground)";
}

export function Graph() {
  const search = useSearch();
  const focus = new URLSearchParams(search).get("focus");
  const project = useLoad(() => api.project());
  const scanId = project.data?.latest?.id ?? null;
  const graph = useLoad(
    () => (scanId === null ? Promise.resolve(null) : api.graph(scanId)),
    [scanId],
  );
  const detail = useLoad(
    () => (scanId === null ? Promise.resolve(null) : api.scan(scanId)),
    [scanId],
  );
  const [view, setView] = useState<View>("graph");

  if (project.error) {
    return <ErrorState description={project.error} retry={project.reload} />;
  }
  if (project.data && !project.data.latest) {
    return (
      <>
        <PageHeader title="Graph" />
        <Empty
          icon={<IconHierarchy />}
          title="No scans yet"
          body="Run a scan to see which server files render which client components, where server actions are called from, and which of those edges carry a finding."
          action={<RunScanButton />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Graph"
        description={
          view === "graph"
            ? "Every file that renders a component from another file, or calls a server action. Bold blue edges cross the server → client boundary; red ones carry a finding."
            : "The App Router tree: one node per directory that owns a page, layout or route handler."
        }
        action={
          <Tabs
            value={view}
            onValueChange={(value) =>
              setView(value === "routes" ? "routes" : "graph")
            }
          >
            <TabsList>
              <TabsTrigger value="graph">
                <IconHierarchy /> Render graph
              </TabsTrigger>
              <TabsTrigger value="routes">
                <IconSitemap /> Route tree
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      {graph.error ? <ErrorNote message={graph.error} /> : null}
      {!graph.data || !detail.data ? (
        <Skeleton className={cn("rounded-xl", CANVAS)} />
      ) : view === "graph" ? (
        <BoundaryGraph
          graph={graph.data}
          findings={detail.data.findings}
          project={project.data}
          focus={focus}
        />
      ) : (
        <RouteTree files={detail.data.files} />
      )}
    </>
  );
}

function BoundaryGraph({
  graph,
  findings,
  project,
  focus,
}: {
  graph: GraphResponse;
  findings: FindingDetail[];
  project: ProjectInfo | null;
  focus: string | null;
}) {
  const { theme } = useTheme();
  const [filters, setFilters] = useState<Filters>(() => ({
    crossingsOnly: false,
    // Start on what matters when there is something that matters.
    findingsOnly:
      focus === null && graph.edges.some((edge) => edge.findings > 0),
    actions: true,
    hideIsolated: false,
  }));
  const [mode, setMode] = useState<LayoutMode>("force");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(focus);
  const [openFinding, setOpenFinding] = useState<FindingDetail | null>(null);
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen();

  useEffect(() => {
    if (focus) setSelected(focus);
  }, [focus]);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );

  const laidOut = useMemo(() => {
    const q = query.trim().toLowerCase();
    let edges = graph.edges.filter(
      (edge) =>
        (filters.actions || edge.kind !== "calls-action") &&
        (!filters.crossingsOnly || edge.crossing) &&
        (!filters.findingsOnly || edge.findings > 0),
    );
    let nodes = graph.nodes;
    if (filters.findingsOnly) {
      const linked = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
      nodes = nodes.filter((node) => node.findings > 0 || linked.has(node.id));
    }
    if (q) {
      const matched = new Set(
        nodes
          .filter((node) => node.path.toLowerCase().includes(q))
          .map((node) => node.id),
      );
      const keep = new Set(matched);
      for (const edge of edges) {
        if (matched.has(edge.from) || matched.has(edge.to)) {
          keep.add(edge.from);
          keep.add(edge.to);
        }
      }
      nodes = nodes.filter((node) => keep.has(node.id));
    }
    const ids = new Set(nodes.map((node) => node.id));
    edges = edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
    if (filters.hideIsolated) {
      const linked = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
      nodes = nodes.filter((node) => linked.has(node.id) || node.id === focus);
    }
    const boxes = nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
    const positions =
      mode === "force"
        ? layoutForce(boxes, edges)
        : layoutDagre(boxes, edges, mode);
    return { nodes, edges, positions };
  }, [graph, filters, query, mode, focus]);

  const flow = useMemo(() => {
    const { nodes, edges, positions } = laidOut;
    const direction = mode === "TB" ? "TB" : "LR";
    const neighbours =
      selected === null
        ? null
        : new Set([
            selected,
            ...edges
              .filter((edge) => edge.from === selected || edge.to === selected)
              .flatMap((edge) => [edge.from, edge.to]),
          ]);

    const flowNodes: FileFlowNode[] = nodes.map((node) => ({
      id: node.id,
      type: "file",
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      initialWidth: NODE_WIDTH,
      initialHeight: NODE_HEIGHT,
      selected: node.id === selected,
      data: {
        path: node.path,
        kind: node.kind,
        findings: node.findings,
        newFindings: node.newFindings,
        serverActions: node.serverActions,
        routeMethods: node.routeMethods,
        dimmed: neighbours !== null && !neighbours.has(node.id),
        focused: node.id === focus,
        direction,
      },
    }));
    const flowEdges: Edge[] = edges.map((edge) => {
      const incident =
        selected === null || edge.from === selected || edge.to === selected;
      const color = edgeColor(edge);
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: mode === "force" ? "straight" : "default",
        animated: edge.newFindings > 0,
        label:
          incident && selected !== null ? edge.names.join(", ") : undefined,
        labelStyle: { fill: "var(--foreground)", fontSize: 10 },
        labelBgStyle: { fill: "var(--card)" },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: color,
          strokeWidth: edge.crossing ? 2 : 1.25,
          opacity: incident ? 1 : 0.12,
          strokeDasharray: edge.kind === "calls-action" ? "6 4" : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 14,
          height: 14,
        },
      };
    });
    return {
      nodes: flowNodes,
      edges: flowEdges,
      crossings: edges.filter((edge) => edge.crossing).length,
      withFindings: edges.filter((edge) => edge.findings > 0).length,
      visibleEdges: edges,
    };
  }, [laidOut, mode, selected, focus]);

  const selectedNode =
    selected === null ? null : (nodeById.get(selected) ?? null);
  const toggle = (key: keyof Filters) =>
    setFilters((current) => ({ ...current, [key]: !current[key] }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="w-full sm:w-64">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Find a file"
          />
        </div>
        <FilterSwitch
          label="Server→Client only"
          tooltip="Show only files that pass data or call actions across the Server→Client boundary. Turn off to see every file in the project."
          checked={filters.crossingsOnly}
          onChange={() => toggle("crossingsOnly")}
        />
        <FilterSwitch
          label="Has findings"
          tooltip="Show only files where at least one security finding (BG-001–004) was detected."
          checked={filters.findingsOnly}
          onChange={() => toggle("findingsOnly")}
        />
        <FilterSwitch
          label="Action calls"
          tooltip="Show edges where a component calls a Server Action."
          checked={filters.actions}
          onChange={() => toggle("actions")}
        />
        <FilterSwitch
          label="Hide disconnected"
          tooltip="Hide files that have no edges to any other file. Turn off to also see standalone route handlers and action modules."
          checked={filters.hideIsolated}
          onChange={() => toggle("hideIsolated")}
        />
        <ToggleGroup
          type="single"
          size="sm"
          value={mode}
          onValueChange={(value) => {
            if (value === "force" || value === "LR" || value === "TB") {
              setMode(value);
            }
          }}
          aria-label="Layout"
          className="sm:ml-auto"
        >
          <ToggleGroupItem
            value="force"
            aria-label="Force layout"
            title="Force layout"
          >
            <IconChartDots3 />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="LR"
            aria-label="Layered, left to right"
            title="Layered, left to right"
          >
            <IconArrowsHorizontal />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="TB"
            aria-label="Layered, top to bottom"
            title="Layered, top to bottom"
          >
            <IconArrowsVertical />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div
        className={cn("flex gap-4", fullscreen ? CANVAS_FULLSCREEN : CANVAS)}
      >
        <div className="bg-surface-soft relative min-w-0 flex-1 overflow-hidden rounded-huge">
          {flow.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Empty
                icon={<IconHierarchy />}
                title="Nothing to draw"
                body={
                  graph.nodes.length === 0
                    ? "No file renders a component declared in another file, and no client file imports a server action — or the tags couldn't be resolved to their declarations."
                    : "Every edge is filtered out. Turn off a filter or clear the search."
                }
                action={
                  graph.nodes.length === 0 ? (
                    <RunScanButton
                      variant="secondary"
                      label="Re-scan codebase"
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFilters({
                          crossingsOnly: false,
                          findingsOnly: false,
                          actions: true,
                          hideIsolated: false,
                        });
                        setQuery("");
                      }}
                    >
                      Clear filters
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <ReactFlowProvider>
              <ReactFlow
                nodes={flow.nodes}
                edges={flow.edges}
                nodeTypes={nodeTypes}
                colorMode={theme}
                fitView
                fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
                minZoom={0.04}
                maxZoom={2}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                onNodeClick={(_event, node) => setSelected(node.id)}
                onPaneClick={() => setSelected(null)}
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={24} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(node) =>
                    KIND_STYLE[(node.data as { kind: GraphNode["kind"] }).kind]
                      .color
                  }
                  nodeStrokeWidth={0}
                  maskColor="color-mix(in oklab, var(--background) 70%, transparent)"
                  // Off on a phone: the canvas is barely wider than the map, and
                  // the status chip already holds the bottom edge.
                  className="!bg-surface-elevated hidden overflow-hidden rounded-mid !border-0 sm:block"
                  style={{ width: 150, height: 100 }}
                />
                <FitOnChange
                  signature={`${mode}:${flow.nodes.length}:${flow.edges.length}`}
                />
                <FocusController target={focus} />
              </ReactFlow>
            </ReactFlowProvider>
          )}
          {/* Full width along the bottom on a phone — the filter row has already
              pushed the canvas down, and a chip that long has no room up here. */}
          <div className="bg-surface-elevated/90 text-muted-foreground absolute right-4 bottom-4 left-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-mid px-3 py-1.5 text-xs backdrop-blur sm:top-4 sm:right-auto sm:bottom-auto sm:left-4">
            <span className="tabular-nums">
              {flow.nodes.length} files, {flow.edges.length} edges.{" "}
              {flow.crossings} cross the boundary, {flow.withFindings} carry a
              finding.
            </span>
          </div>
          {/* Steps aside for the panel rather than sitting under it — the panel
              is an overlay, so nothing is hidden and nothing is covered. On a
              phone the panel takes the whole canvas, so there is nothing to
              step aside for. */}
          <div
            className={cn(
              "absolute top-4 flex flex-col items-end gap-2 transition-[right] duration-200 motion-reduce:transition-none",
              selectedNode ? "right-4 sm:right-[21.5rem]" : "right-4",
            )}
          >
            <FullscreenButton
              fullscreen={fullscreen}
              onToggle={toggleFullscreen}
            />
            {/* The legend is five lines of prose; over a phone-width canvas it
                would cover the diagram it explains. */}
            <div className="hidden sm:block">
              <Legend />
            </div>
          </div>

          {/* Overlaid on the canvas rather than a flex sibling: as a sibling the
              panel narrowed the pane by 21rem on every selection, which reflowed
              the diagram and threw away the zoom the reader had just set. */}
          {selectedNode ? (
            <NodePanel
              node={selectedNode}
              edges={flow.visibleEdges}
              findings={findings.filter(
                (finding) =>
                  finding.file === selectedNode.id &&
                  finding.status !== "suppressed",
              )}
              onSelect={setSelected}
              onClose={() => setSelected(null)}
              onOpenFinding={setOpenFinding}
            />
          ) : null}
        </div>
      </div>

      <FindingSheet
        finding={openFinding}
        project={project}
        onClose={() => setOpenFinding(null)}
      />
    </>
  );
}

function FilterSwitch({
  label,
  tooltip,
  checked,
  onChange,
}: {
  label: string;
  tooltip?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={checked}
            onCheckedChange={onChange}
            aria-label={label}
          />
          <span>{label}</span>
          {tooltip ? (
            <IconInfoCircle className="size-3.5 text-muted-foreground" />
          ) : null}
        </label>
      </TooltipTrigger>
      {tooltip ? (
        <TooltipContent side="bottom" className="max-w-56 text-center">
          {tooltip}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

/** Refits the viewport whenever the drawn set changes — filters, layout, expand/collapse. */
function FitOnChange({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.12, maxZoom: 1, duration: 250 });
    });
    return () => cancelAnimationFrame(frame);
  }, [signature, fitView]);
  return null;
}

/** Pans to the selected node when it changes (deep links from Findings/Files land here). */
function FocusController({ target }: { target: string | null }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      void fitView({
        nodes: [{ id: target }],
        duration: 400,
        maxZoom: 1,
        padding: 2,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [target, fitView]);
  return null;
}

function Legend() {
  const line = (color: string, dashed = false, thick = false) => (
    <span
      className={cn("inline-block w-4", thick ? "h-0.5" : "h-px")}
      style={{
        background: dashed ? "transparent" : color,
        borderTop: dashed ? `1px dashed ${color}` : undefined,
      }}
    />
  );
  return (
    <div className="bg-surface-elevated/90 text-muted-foreground flex max-w-xs flex-wrap items-center justify-end gap-x-4 gap-y-1 rounded-mid px-3 py-1.5 text-xs backdrop-blur">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="bg-card inline-block size-3 rounded-xs"
          style={{ boxShadow: "inset 0 0 0 1px var(--divider-subtle)" }}
        />
        server
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="bg-card text-foreground inline-block size-3 rounded-xs"
          style={{
            boxShadow: "inset 0 0 0 1px var(--divider-subtle)",
            backgroundImage:
              "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 4px)",
          }}
        />
        client, hatched
      </span>
      <span className="bg-divider-subtle mx-1 h-3 w-px" />
      <span className="flex items-center gap-1.5">
        {line("var(--muted-foreground)", false, true)} crosses the boundary
      </span>
      <span className="flex items-center gap-1.5">
        {line("var(--muted-foreground)", true)} action call
      </span>
      <span className="flex items-center gap-1.5">
        {line("var(--destructive)", false, true)} carries a finding
      </span>
    </div>
  );
}

function NodePanel({
  node,
  edges,
  findings,
  onSelect,
  onClose,
  onOpenFinding,
}: {
  node: GraphNode;
  edges: GraphEdge[];
  findings: FindingDetail[];
  onSelect: (id: string) => void;
  onClose: () => void;
  onOpenFinding: (finding: FindingDetail) => void;
}) {
  const style = KIND_STYLE[node.kind];
  const outgoing = edges.filter((edge) => edge.from === node.id);
  const incoming = edges.filter((edge) => edge.to === node.id);
  const { dir, base } = splitPath(node.path);
  return (
    // On a phone a 20rem panel beside a canvas this narrow leaves a sliver of
    // diagram behind it, so it takes the canvas instead of sharing it.
    <aside className="bg-card absolute inset-3 z-10 flex flex-col overflow-hidden rounded-huge sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-80">
      <div className="p-4 sm:p-5">
        <SectionHeader
          title={base}
          description={style.label}
          // Row regardless of width, unlike a page header: the action is the
          // panel's close button, and below the title it reads as a footer.
          className="flex-row items-start gap-3"
          action={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX />
            </Button>
          }
        />
        <p className="text-muted-foreground mt-3 font-mono text-[11px] break-all">
          {dir || "."}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {node.routeMethods.map((method) => (
            <Badge key={method} variant="soft-muted" className="font-mono">
              {method}
            </Badge>
          ))}
          {node.serverActions.map((action) => (
            <Badge key={action} variant="soft-success" className="font-mono">
              {action}()
            </Badge>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-2 sm:px-5">
        <PanelSection title="Findings" count={findings.length}>
          {findings.length === 0 ? (
            <p className="text-muted-foreground text-xs">None in this file.</p>
          ) : (
            findings.map((finding) => (
              <button
                key={finding.id}
                type="button"
                onClick={() => onOpenFinding(finding)}
                className="hover:bg-surface-soft bg-surface-soft/50 flex w-full flex-col gap-1 rounded-mid p-3 text-left transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <RuleTag id={finding.ruleId} />
                  <StatusPill status={finding.status} />
                  <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                    :{finding.line}
                  </span>
                </span>
                <span className="line-clamp-2 text-xs">{finding.message}</span>
              </button>
            ))
          )}
        </PanelSection>
        <PanelSection title="Renders and calls" count={outgoing.length}>
          {outgoing.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Nothing from another file.
            </p>
          ) : (
            outgoing.map((edge) => (
              <EdgeRow
                key={edge.id}
                edge={edge}
                other={edge.to}
                onSelect={onSelect}
              />
            ))
          )}
        </PanelSection>
        <PanelSection
          title="Rendered by or called from"
          count={incoming.length}
        >
          {incoming.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Nothing points here.
            </p>
          ) : (
            incoming.map((edge) => (
              <EdgeRow
                key={edge.id}
                edge={edge}
                other={edge.from}
                onSelect={onSelect}
              />
            ))
          )}
        </PanelSection>
      </div>
      <div className="p-4">
        <Button variant="secondary" size="sm" className="w-full" asChild>
          <Link href={`/files?q=${encodeURIComponent(node.path)}`}>
            <IconFocus2 /> Open in Files
          </Link>
        </Button>
      </div>
    </aside>
  );
}

function PanelSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-2 flex items-baseline gap-1.5 text-xs font-semibold">
        {title}
        <span className="text-muted-foreground font-normal tabular-nums">
          {count}
        </span>
      </h4>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function EdgeRow({
  edge,
  other,
  onSelect,
}: {
  edge: GraphEdge;
  other: string;
  onSelect: (id: string) => void;
}) {
  const { base } = splitPath(other);
  return (
    <button
      type="button"
      onClick={() => onSelect(other)}
      className="hover:bg-surface-soft bg-surface-soft/50 flex w-full items-center gap-2.5 rounded-mid p-2.5 text-left transition-colors cursor-pointer"
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: edgeColor(edge) }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{base}</span>
        <span className="text-muted-foreground block truncate font-mono text-[10px]">
          {edge.kind === "calls-action" ? "calls " : ""}
          {edge.names.join(", ")}
          {edge.count > edge.names.length ? ` ×${edge.count}` : ""}
        </span>
      </span>
      {edge.findings > 0 ? (
        <Badge variant={edge.newFindings > 0 ? "destructive" : "soft-warning"}>
          {edge.findings}
        </Badge>
      ) : null}
    </button>
  );
}

function RouteTree({ files }: { files: FileDetail[] }) {
  const { theme } = useTheme();
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen();
  const segments = useMemo(() => buildRouteTree(files), [files]);
  const children = useMemo(() => {
    const map = new Map<string, RouteSegment[]>();
    for (const segment of segments) {
      if (segment.parent === null) continue;
      map.set(segment.parent, [...(map.get(segment.parent) ?? []), segment]);
    }
    return map;
  }, [segments]);
  // Root and its first level open; everything deeper waits for a click.
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        segments.filter((segment) => segment.depth === 0).map((s) => s.id),
      ),
  );
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const flow = useMemo(() => {
    const byId = new Map(segments.map((segment) => [segment.id, segment]));
    const visible = segments.filter((segment) => {
      let parent = segment.parent;
      while (parent !== null) {
        if (!expanded.has(parent)) return false;
        parent = byId.get(parent)?.parent ?? null;
      }
      return true;
    });
    const links = visible.flatMap((segment) =>
      segment.parent === null ? [] : [{ from: segment.parent, to: segment.id }],
    );
    const positions = layoutDagre(
      visible.map((segment) => ({
        id: segment.id,
        width: ROUTE_NODE_WIDTH,
        height: ROUTE_NODE_HEIGHT + Math.max(0, segment.files.length - 3) * 8,
      })),
      links,
      "TB",
      { nodesep: 20, ranksep: 56 },
    );
    const nodes: RouteFlowNode[] = visible.map((segment) => ({
      id: segment.id,
      type: "route",
      position: positions.get(segment.id) ?? { x: 0, y: 0 },
      initialWidth: ROUTE_NODE_WIDTH,
      initialHeight:
        ROUTE_NODE_HEIGHT + Math.max(0, segment.files.length - 3) * 8,
      data: {
        segment: segment.segment,
        href: segment.href,
        files: segment.files,
        children: children.get(segment.id)?.length ?? 0,
        expanded: expanded.has(segment.id),
      },
    }));
    const edges: Edge[] = links.map((link) => ({
      id: `${link.from}->${link.to}`,
      source: link.from,
      target: link.to,
      type: "smoothstep",
      style: { stroke: "var(--divider-subtle)", strokeWidth: 1.5 },
    }));
    return { nodes, edges, visible: visible.length };
  }, [segments, children, expanded]);

  if (segments.length === 0) {
    return (
      <Empty
        icon={<IconSitemap />}
        title="No routes found"
        body="No page, layout or route handler was found under app/ or src/app/."
      />
    );
  }
  const pages = segments.reduce(
    (n, segment) =>
      n + segment.files.filter((file) => file.name === "page").length,
    0,
  );
  const handlers = segments.reduce(
    (n, segment) =>
      n + segment.files.filter((file) => file.name === "route").length,
    0,
  );
  return (
    <div
      className={cn(
        "bg-surface-soft relative overflow-hidden rounded-huge",
        fullscreen ? CANVAS_FULLSCREEN : CANVAS,
      )}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          colorMode={theme}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
          minZoom={0.04}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_event, node) => toggle(node.id)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={0}
            nodeColor="var(--foreground)"
            maskColor="color-mix(in oklab, var(--background) 70%, transparent)"
            className="!bg-surface-elevated hidden overflow-hidden rounded-mid !border-0 sm:block"
            style={{ width: 150, height: 100 }}
          />
          {/* Keyed to the tree, not to the drawn node count. Expanding a
              segment changes the latter, and refitting on that signature meant
              every click to read a subtree reframed the whole diagram — so the
              zoom the reader had just chosen was discarded each time. */}
          <FitOnChange signature={`routes:${segments.length}`} />
        </ReactFlow>
      </ReactFlowProvider>
      <div className="bg-surface-elevated/90 text-muted-foreground absolute right-4 bottom-4 left-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-mid px-3 py-1.5 text-xs tabular-nums backdrop-blur sm:top-4 sm:right-auto sm:bottom-auto sm:left-4">
        <span>
          Showing {flow.visible} of {segments.length} segments. {pages} pages,{" "}
          {handlers} route handlers.
        </span>
        <span className="bg-divider-subtle h-3 w-px" />
        <button
          type="button"
          className="hover:text-foreground cursor-pointer transition-colors"
          onClick={() =>
            setExpanded(new Set(segments.map((segment) => segment.id)))
          }
        >
          Expand all
        </button>
        <button
          type="button"
          className="hover:text-foreground cursor-pointer transition-colors"
          onClick={() =>
            setExpanded(
              new Set(segments.filter((s) => s.depth === 0).map((s) => s.id)),
            )
          }
        >
          Collapse
        </button>
      </div>

      <div className="absolute top-4 right-4">
        <FullscreenButton fullscreen={fullscreen} onToggle={toggleFullscreen} />
      </div>
    </div>
  );
}
