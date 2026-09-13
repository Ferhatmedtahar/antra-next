import { IconFiles, IconFolder, IconHierarchy } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";

import type { FileDetail } from "../../../../src/studio/types.js";

import { api } from "@/api";
import {
  Empty,
  ErrorNote,
  ErrorState,
  ListNote,
  ListPanel,
  LoadingRows,
  PageHeader,
  RunScanButton,
  ZoneTag,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoad } from "@/hooks";
import { cn } from "@/lib/utils";

/** Same id on the row and the scroll target so a `?q=` deep link can find it. */
function fileRowId(path: string): string {
  return `file-row-${encodeURIComponent(path)}`;
}

type View = "all" | "client" | "actions" | "routes";
const VIEWS: View[] = ["all", "client", "actions", "routes"];
const isView = (value: string): value is View =>
  (VIEWS as string[]).includes(value);

function splitPath(path: string): { dir: string; base: string } {
  const at = path.lastIndexOf("/");
  return at === -1
    ? { dir: ".", base: path }
    : { dir: path.slice(0, at), base: path.slice(at + 1) };
}

export function Files() {
  const project = useLoad(() => api.project());
  const latestId = project.data?.latest?.id ?? null;
  const detail = useLoad(
    () => (latestId === null ? Promise.resolve(null) : api.scan(latestId)),
    [latestId],
  );
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const search = useSearch();
  const targetPath = new URLSearchParams(search).get("q");
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!targetPath || !detail.data) return;
    const row = document.getElementById(fileRowId(targetPath));
    if (!row) return;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(targetPath);
    const timer = setTimeout(() => setHighlighted(null), 3000);
    return () => clearTimeout(timer);
  }, [targetPath, detail.data]);

  const files = detail.data?.files ?? [];
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = files.filter((f) => {
      const inView =
        view === "all" ||
        (view === "client" && f.boundary === "client") ||
        (view === "actions" && f.serverActions.length > 0) ||
        (view === "routes" && f.isRouteHandler);
      return inView && (q === "" || f.path.toLowerCase().includes(q));
    });
    const byDir = new Map<string, { base: string; file: FileDetail }[]>();
    for (const file of visible) {
      const { dir, base } = splitPath(file.path);
      const group = byDir.get(dir) ?? [];
      group.push({ base, file });
      byDir.set(dir, group);
    }
    return [...byDir.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [files, view, query]);

  const counts = {
    client: files.filter((f) => f.boundary === "client").length,
    actions: files.reduce((n, f) => n + f.serverActions.length, 0),
    routes: files.filter((f) => f.isRouteHandler).length,
  };

  if (project.error) {
    return <ErrorState description={project.error} retry={project.reload} />;
  }
  if (project.data && !project.data.latest) {
    return (
      <>
        <PageHeader title="Files" />
        <Empty
          icon={<IconFiles />}
          title="No scans yet"
          body="Run a scan to see every file classified as server or client, with its server actions and route handlers."
          action={<RunScanButton />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Files"
        description={`${files.length} files across the codebase. ${counts.client} client boundaries, ${counts.actions} server actions, and ${counts.routes} route handlers.`}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Tabs
          value={view}
          onValueChange={(value) => {
            if (isView(value)) setView(value);
          }}
        >
          <TabsList variant="underline">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="client">
              Client{" "}
              <span className="text-micro font-mono ml-1 opacity-70">
                {counts.client}
              </span>
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions{" "}
              <span className="text-micro font-mono ml-1 opacity-70">
                {counts.actions}
              </span>
            </TabsTrigger>
            <TabsTrigger value="routes">
              Routes{" "}
              <span className="text-micro font-mono ml-1 opacity-70">
                {counts.routes}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="w-80 ml-auto">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Filter by path"
          />
        </div>
      </div>
      {!detail.data ? (
        <LoadingRows />
      ) : (
        <ListPanel>
          {groups.length === 0 ? (
            <div className="py-8">
              <Empty
                icon={<IconFiles />}
                title="No files match that filter"
                body="Try adjusting your search query or switching views."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setView("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : null}
          {groups.map(([dir, entries]) => (
            <div key={dir}>
              <div className="bg-surface-soft flex items-center gap-2.5 px-6 py-3">
                <IconFolder className="text-foreground size-4" />
                <span className="font-mono text-sm font-medium text-foreground">
                  {dir}
                </span>
                <span className="text-muted-foreground text-label-2-m">
                  {entries.length} file{entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="divide-divider-subtle divide-y">
                {entries.map(({ base, file }) => (
                  <li
                    key={file.path}
                    id={fileRowId(file.path)}
                    className={cn(
                      "flex items-center gap-4 px-6 py-3 transition-colors duration-700 hover:bg-surface-soft/40",
                      highlighted === file.path && "bg-primary/10",
                    )}
                  >
                    <ZoneTag zone={file.boundary} />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">
                      {base}
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {file.isRouteHandler ? (
                        <Badge variant="code" className="font-mono">
                          route [{file.routeMethods.join(", ")}]
                        </Badge>
                      ) : null}
                      {file.serverActions.map((action) => (
                        <Badge
                          key={`${action.name}:${action.line}`}
                          variant="code"
                          className="font-mono"
                        >
                          {action.name}:{action.line}
                        </Badge>
                      ))}
                      {file.isServerActionModule ? (
                        <Badge variant="code" className="font-mono">
                          'use server' module
                        </Badge>
                      ) : null}
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/graph?focus=${encodeURIComponent(file.path)}`}
                        >
                          <IconHierarchy className="size-3.5" />
                        </Link>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </ListPanel>
      )}
    </>
  );
}
