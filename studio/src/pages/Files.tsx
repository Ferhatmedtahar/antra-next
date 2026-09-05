import { IconFiles, IconFolder, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";

import type { FileDetail } from "../../../src/studio/types.js";

import { api } from "@/api";
import {
  Empty,
  ErrorNote,
  ListNote,
  ListPanel,
  LoadingRows,
  PageHeader,
  ZoneTag,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoad } from "@/hooks";

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

  if (project.error) return <ErrorNote message={project.error} />;
  if (project.data && !project.data.latest) {
    return (
      <>
        <PageHeader icon={<IconFiles />} title="Files" />
        <Empty
          icon={<IconFiles />}
          title="No scans yet"
          body="Run a scan to see every file classified as server or client, with its server actions and route handlers."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={<IconFiles />}
        title="Files"
        description={`${files.length} files · ${counts.client} client boundaries · ${counts.actions} server actions · ${counts.routes} route handlers`}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={view}
          onValueChange={(value) => {
            if (isView(value)) setView(value);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="client">
              Client <Count n={counts.client} />
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions <Count n={counts.actions} />
            </TabsTrigger>
            <TabsTrigger value="routes">
              Routes <Count n={counts.routes} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto">
          <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by path"
            className="w-72 pl-9"
          />
        </div>
      </div>
      {!detail.data ? (
        <LoadingRows />
      ) : (
        <ListPanel>
          {groups.length === 0 ? (
            <ListNote>Nothing matches that filter.</ListNote>
          ) : null}
          {groups.map(([dir, entries]) => (
            <div key={dir}>
              <div className="bg-muted/50 flex items-center gap-2.5 px-5 py-2.5">
                <IconFolder className="text-primary size-4" />
                <span className="font-mono text-sm font-medium">{dir}</span>
                <span className="text-muted-foreground text-xs">
                  {entries.length} file{entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="divide-border divide-y">
                {entries.map(({ base, file }) => (
                  <li
                    key={file.path}
                    className="flex items-center gap-4 px-5 py-2.5"
                  >
                    <ZoneTag zone={file.boundary} />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">
                      {base}
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {file.isRouteHandler ? (
                        <Badge variant="soft-primary" className="font-mono">
                          route [{file.routeMethods.join(", ")}]
                        </Badge>
                      ) : null}
                      {file.serverActions.map((action) => (
                        <Badge
                          key={`${action.name}:${action.line}`}
                          variant="soft-primary"
                          className="font-mono"
                        >
                          {action.name}:{action.line}
                        </Badge>
                      ))}
                      {file.isServerActionModule ? (
                        <Badge variant="soft-muted">"use server"</Badge>
                      ) : null}
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

function Count({ n }: { n: number }) {
  return (
    <Badge variant="soft-muted" className="ml-1 h-5 px-1.5 tabular-nums">
      {n}
    </Badge>
  );
}
