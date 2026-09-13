import type { FileDetail } from "../../../../../src/studio/types.js";

export interface RouteFile {
  /** page, layout, route, loading, error, template, default, not-found */
  name: string;
  boundary: "server" | "client";
  methods: string[];
  actions: number;
}

export interface RouteSegment {
  id: string;
  /** Directory name inside app/: "(auth)", "[id]", "settings", "/" for the root. */
  segment: string;
  /** URL the segment serves, route groups and parallel slots removed. */
  href: string;
  parent: string | null;
  depth: number;
  files: RouteFile[];
}

const SPECIAL =
  /^(page|layout|route|loading|error|template|default|not-found|global-error)\.(?:tsx?|jsx?)$/;

function hrefFor(parts: readonly string[]): string {
  const visible = parts.filter(
    (part) =>
      !(part.startsWith("(") && part.endsWith(")")) && !part.startsWith("@"),
  );
  return `/${visible.join("/")}`;
}

/** The App Router tree: one node per directory that owns a page, layout or route handler. */
export function buildRouteTree(files: readonly FileDetail[]): RouteSegment[] {
  const appRoot = files.some((file) => file.path.startsWith("src/app/"))
    ? "src/app"
    : files.some((file) => file.path.startsWith("app/"))
      ? "app"
      : null;
  if (!appRoot) return [];

  const segments = new Map<string, RouteSegment>();
  const ensure = (dir: string): RouteSegment => {
    const existing = segments.get(dir);
    if (existing) return existing;
    const parts = dir === "" ? [] : dir.split("/");
    const parentDir = parts.length === 0 ? null : parts.slice(0, -1).join("/");
    const parent = parentDir === null ? null : ensure(parentDir);
    const segment: RouteSegment = {
      id: dir === "" ? "/" : dir,
      segment: parts[parts.length - 1] ?? "/",
      href: hrefFor(parts),
      parent: parent?.id ?? null,
      depth: parts.length,
      files: [],
    };
    segments.set(dir, segment);
    return segment;
  };

  for (const file of files) {
    if (!file.path.startsWith(`${appRoot}/`)) continue;
    const relative = file.path.slice(appRoot.length + 1);
    const at = relative.lastIndexOf("/");
    const dir = at === -1 ? "" : relative.slice(0, at);
    const name = at === -1 ? relative : relative.slice(at + 1);
    if (!SPECIAL.test(name)) continue;
    ensure(dir).files.push({
      name: name.replace(/\.(?:tsx?|jsx?)$/, ""),
      boundary: file.boundary,
      methods: file.routeMethods,
      actions: file.serverActions.length,
    });
  }
  for (const segment of segments.values()) {
    segment.files.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...segments.values()].sort((a, b) => a.id.localeCompare(b.id));
}
