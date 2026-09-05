import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { serve, type ServerType } from "@hono/node-server";
import { Hono } from "hono";
import { ZodError } from "zod";

import { baselinePath, writeBaseline } from "../baseline/baseline.js";
import {
  isSensitiveName,
  normalizeFieldName,
  sensitivityFromConfig,
} from "../classification/classify.js";
import { loadConfigIfPresent, loadSnapshot } from "../config/load.js";
import { boundaryGuardConfigSchema } from "../config/types.js";
import { writeConfig } from "../config/write.js";
import { runScan } from "../engine.js";
import { VERSION } from "../index.js";
import { rules } from "../rules/index.js";
import {
  FindingsStore,
  type StoredFile,
  type StoredFinding,
} from "../storage/db.js";
import type {
  BaselineResponse,
  CodeFrame,
  FindingDetail,
  GraphEdge,
  GraphNode,
  GraphResponse,
  ProjectInfo,
  RuleInfo,
  ScanDetail,
  ScanRunResponse,
  ScanSummary,
  SourcesResponse,
  StudioConfig,
} from "./types.js";

const FRAME_CONTEXT = 2;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Where `vite build` put the SPA — next to the bundled CLI, or under dist/ when running from source. */
export function resolveAssetsDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const relative of [
    "../studio",
    "../../dist/studio",
    "../../../dist/studio",
  ]) {
    const candidate = path.resolve(here, relative);
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
  }
  return null;
}

function withStore<T>(rootDir: string, fn: (store: FindingsStore) => T): T {
  const store = FindingsStore.open(rootDir);
  try {
    return fn(store);
  } finally {
    store.close();
  }
}

function frameFor(
  rootDir: string,
  cache: Map<string, string[] | null>,
  finding: StoredFinding,
): CodeFrame | null {
  const absolute = path.join(rootDir, finding.file);
  if (!cache.has(absolute)) {
    try {
      cache.set(absolute, fs.readFileSync(absolute, "utf8").split(/\r?\n/));
    } catch {
      cache.set(absolute, null);
    }
  }
  const lines = cache.get(absolute);
  if (!lines) return null;
  const startLine = Math.max(1, finding.line - FRAME_CONTEXT);
  const endLine = Math.min(lines.length, finding.line + FRAME_CONTEXT);
  return { startLine, lines: lines.slice(startLine - 1, endLine) };
}

function listedIn(
  entries: readonly string[],
  field: string,
  origin: string,
): boolean {
  const normalized = normalizeFieldName(field);
  return entries.some(
    (entry) => entry === origin || normalizeFieldName(entry) === normalized,
  );
}

/** Every route the Studio SPA talks to. Pure adapter over the engine — no logic of its own. */
export function createStudioApp(rootDir: string): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof ZodError) {
      return c.json({ error: "Invalid config", issues: error.issues }, 400);
    }
    return c.json({ error: error.message }, 500);
  });

  app.get("/api/project", async (c) => {
    const config = await loadConfigIfPresent(rootDir);
    const latest = withStore(rootDir, (store) => store.latestScan());
    const info: ProjectInfo = {
      rootDir,
      name: path.basename(rootDir),
      configPresent: config !== null,
      version: VERSION,
      latest: latest ? toSummary(latest) : null,
    };
    return c.json(info);
  });

  app.get("/api/rules", (c) => {
    const info: RuleInfo[] = rules.map((rule) => ({
      id: rule.id,
      severity: rule.severity,
      description: rule.description,
    }));
    return c.json(info);
  });

  app.get("/api/scans", (c) => {
    const scans: ScanSummary[] = withStore(rootDir, (store) =>
      store.listScans(100).map(toSummary),
    );
    return c.json(scans);
  });

  app.get("/api/scans/:id", (c) => {
    const id = Number(c.req.param("id"));
    const detail = withStore(rootDir, (store): ScanDetail | null => {
      const scan = store.listScans(1000).find((entry) => entry.id === id);
      if (!scan) return null;
      const cache = new Map<string, string[] | null>();
      const findings: FindingDetail[] = store
        .findingsForScan(id)
        .map((finding) => ({
          ...finding,
          frame: frameFor(rootDir, cache, finding),
        }));
      return { scan: toSummary(scan), findings, files: store.filesForScan(id) };
    });
    return detail ? c.json(detail) : c.json({ error: `No scan ${id}` }, 404);
  });

  app.get("/api/scans/:id/graph", (c) => {
    const id = Number(c.req.param("id"));
    const graph = withStore(rootDir, (store): GraphResponse | null => {
      if (!store.listScans(1000).some((entry) => entry.id === id)) return null;
      return buildGraph(
        id,
        store.filesForScan(id),
        store.findingsForScan(id),
        store.edgesForScan(id),
      );
    });
    return graph ? c.json(graph) : c.json({ error: `No scan ${id}` }, 404);
  });

  app.get("/api/sources", async (c) => {
    const config = await loadConfigIfPresent(rootDir);
    const snapshot = config ? await loadSnapshot(rootDir) : null;
    const response: SourcesResponse = {
      generatedAt: snapshot?.generatedAt ?? null,
      fields: [],
    };
    if (config && snapshot) {
      const sensitivity = sensitivityFromConfig(config);
      const keywordsOnly = {
        keywords: sensitivity.keywords,
        pinned: [],
        ignored: [],
      };
      response.fields = snapshot.sources.map((source) => ({
        field: source.field,
        origin: source.origin,
        sensitive: isSensitiveName(source.field, sensitivity, source.origin),
        keywordHit: isSensitiveName(source.field, keywordsOnly),
        pinned: listedIn(
          config.sensitiveFields.include,
          source.field,
          source.origin,
        ),
        ignored: listedIn(
          [
            ...config.sensitiveFields.exclude,
            ...(config.keywords.exclude ?? []),
          ],
          source.field,
          source.origin,
        ),
      }));
    }
    return c.json(response);
  });

  app.get("/api/config", async (c) => {
    const config: StudioConfig | null = await loadConfigIfPresent(rootDir);
    return c.json(config);
  });

  app.put("/api/config", async (c) => {
    const config = boundaryGuardConfigSchema.parse(await c.req.json());
    await writeConfig(rootDir, config, { overwrite: true });
    const saved: StudioConfig = config;
    return c.json(saved);
  });

  app.post("/api/scan", async (c) => {
    const result = await runScan({ rootDir });
    const response: ScanRunResponse = {
      scanId: result.scanId,
      findings: result.findings.length,
      baselined: result.baselined.length,
      suppressed: result.suppressed.length,
      durationMs: result.durationMs,
      storeError: result.storeError,
    };
    return c.json(response);
  });

  app.post("/api/baseline", async (c) => {
    const result = await runScan({
      rootDir,
      ignoreBaseline: true,
      store: false,
    });
    const fingerprints = result.findings.flatMap((f) =>
      f.fingerprint ? [f.fingerprint] : [],
    );
    await writeBaseline(rootDir, fingerprints);
    const byRule: Record<string, number> = {};
    for (const finding of result.findings) {
      byRule[finding.ruleId] = (byRule[finding.ruleId] ?? 0) + 1;
    }
    const response: BaselineResponse = {
      recorded: fingerprints.length,
      byRule,
      file: path.relative(rootDir, baselinePath(rootDir)),
    };
    return c.json(response);
  });

  const assetsDir = resolveAssetsDir();
  app.get("*", async (c) => {
    if (!assetsDir) {
      return c.text(
        "Studio assets are not built. Run `pnpm build:studio` in boundary-guard, then try again.",
        503,
      );
    }
    const requested = decodeURIComponent(new URL(c.req.url).pathname);
    const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
    const candidate = path.join(assetsDir, normalized);
    const file =
      candidate.startsWith(assetsDir) &&
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile()
        ? candidate
        : path.join(assetsDir, "index.html");
    const body = await fs.promises.readFile(file);
    return c.body(body, 200, {
      "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": file.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });
  });

  return app;
}

function nodeKind(file: StoredFile): GraphNode["kind"] {
  if (file.isRouteHandler) return "route";
  if (file.boundary === "client") return "client";
  if (file.isServerActionModule || file.serverActions.length > 0) {
    return "action";
  }
  return "server";
}

/** `… to client component <UserCard> …` → UserCard */
const COMPONENT_IN_MESSAGE = /<([A-Za-z_$][\w$.]*)>/;

/**
 * Nodes are the files that take part in an edge or carry a finding; edges
 * get the BG-001/BG-003 findings whose sink component they carry.
 */
export function buildGraph(
  scanId: number,
  files: StoredFile[],
  findings: StoredFinding[],
  stored: {
    from: string;
    to: string;
    kind: GraphEdge["kind"];
    names: string[];
    count: number;
  }[],
): GraphResponse {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const counted = findings.filter((finding) => finding.status !== "suppressed");
  const fileFindings = new Map<string, { all: number; fresh: number }>();
  for (const finding of counted) {
    const entry = fileFindings.get(finding.file) ?? { all: 0, fresh: 0 };
    entry.all += 1;
    if (finding.status === "active") entry.fresh += 1;
    fileFindings.set(finding.file, entry);
  }

  const edges: GraphEdge[] = stored.map((edge) => {
    const fromFile = byPath.get(edge.from);
    const toFile = byPath.get(edge.to);
    const crossing =
      edge.kind === "calls-action" ||
      (fromFile?.boundary === "server" && toFile?.boundary === "client");
    const onEdge = counted.filter(
      (finding) =>
        edge.kind === "renders" &&
        finding.file === edge.from &&
        (finding.ruleId === "BG-001" || finding.ruleId === "BG-003") &&
        edge.names.includes(
          COMPONENT_IN_MESSAGE.exec(finding.message)?.[1] ?? "",
        ),
    );
    return {
      id: `${edge.kind}:${edge.from}->${edge.to}`,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      names: edge.names,
      count: edge.count,
      crossing,
      findings: onEdge.length,
      newFindings: onEdge.filter((finding) => finding.status === "active")
        .length,
    };
  });

  const involved = new Set<string>();
  for (const edge of edges) {
    involved.add(edge.from);
    involved.add(edge.to);
  }
  for (const file of fileFindings.keys()) involved.add(file);

  const nodes: GraphNode[] = files
    .filter((file) => involved.has(file.path))
    .map((file) => ({
      id: file.path,
      path: file.path,
      kind: nodeKind(file),
      boundary: file.boundary,
      serverActions: file.serverActions.map((action) => action.name),
      routeMethods: file.routeMethods,
      findings: fileFindings.get(file.path)?.all ?? 0,
      newFindings: fileFindings.get(file.path)?.fresh ?? 0,
    }));

  return { scanId, nodes, edges };
}

function toSummary(scan: {
  id: number;
  startedAt: string;
  durationMs: number;
  framework: string;
  rules: ScanSummary["rules"];
  files: number;
  schemaFields: number;
  taintSources: number;
  findings: number;
  suppressed: number;
  baselined: number;
}): ScanSummary {
  const {
    id,
    startedAt,
    durationMs,
    framework,
    rules: ruleIds,
    files,
    schemaFields,
    taintSources,
    findings,
    suppressed,
    baselined,
  } = scan;
  return {
    id,
    startedAt,
    durationMs,
    framework,
    rules: ruleIds,
    files,
    schemaFields,
    taintSources,
    findings,
    suppressed,
    baselined,
  };
}

export interface StudioOptions {
  rootDir: string;
  port: number;
  open: boolean;
}

export interface StudioHandle {
  url: string;
  close: () => void;
}

/** Binds to localhost only — this serves the project's findings and can rewrite its config. */
export function startStudio(options: StudioOptions): Promise<StudioHandle> {
  const app = createStudioApp(options.rootDir);
  return new Promise((resolve) => {
    const server: ServerType = serve(
      { fetch: app.fetch, port: options.port, hostname: "127.0.0.1" },
      (info) => {
        const url = `http://127.0.0.1:${info.port}`;
        if (options.open) openBrowser(url);
        resolve({ url, close: () => server.close() });
      },
    );
  });
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // Not fatal — the URL is printed either way.
  }
}
