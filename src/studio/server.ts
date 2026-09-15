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
import { antraConfigSchema } from "../config/types.js";
import { writeConfig } from "../config/write.js";
import { runScan } from "../engine.js";
import { VERSION } from "../index.js";
import { rules } from "../rules/index.js";
import { normalizeTraceStep } from "../rules/types.js";
import {
  FindingsStore,
  type StoredFile,
  type StoredFinding,
} from "../storage/db.js";
import type { PackageManager } from "../utils/package-manager.js";
import {
  STUDIO_REQUEST_HEADER,
  type BaselineResponse,
  type CodeFrame,
  type FindingDetail,
  type GraphEdge,
  type GraphNode,
  type GraphResponse,
  type ProjectInfo,
  type RuleInfo,
  type ScanDetail,
  type ScanRunResponse,
  type ScanSummary,
  type SourcesResponse,
  type StudioConfig,
  type TraceStep,
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

/** The line and file a frame can be built around. Both callers below satisfy it. */
interface FrameTarget {
  file: string;
  line: number;
}

function frameFor(
  rootDir: string,
  cache: Map<string, string[] | null>,
  finding: FrameTarget,
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

/**
 * A frame for one taint hop.
 *
 * Unlike the sink, a hop's location is optional — the engine records steps it
 * cannot pin to a line — so this guards and returns null rather than
 * fabricating a location. A missing frame degrades one hop in the prompt; it
 * never fails the request.
 */
export function hopFrame(
  rootDir: string,
  cache: Map<string, string[] | null>,
  step: TraceStep,
): CodeFrame | null {
  if (!step.file || !step.line) return null;
  return frameFor(rootDir, cache, { file: step.file, line: step.line });
}

/** Lockfile order is precedence order; npm is the fallback. */
export function detectPackageManager(rootDir: string): PackageManager {
  if (fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(rootDir, "bun.lockb"))) return "bun";
  return "npm";
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

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
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

  // Binding to 127.0.0.1 isn't enough on its own: any page in the user's
  // browser can still send requests here. A non-local Host is DNS rebinding;
  // a state change without the custom header (or from a foreign Origin) is
  // CSRF — e.g. silently baselining every finding.
  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("Origin");
    const forbidden =
      !isLocalUrl(c.req.url) ||
      (origin !== undefined && !isLocalUrl(origin)) ||
      (UNSAFE_METHODS.has(c.req.method) &&
        c.req.header(STUDIO_REQUEST_HEADER) !== "1");
    if (forbidden) {
      return c.json({ error: "forbidden: cross-origin request" }, 403);
    }
    await next();
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
      packageManager: detectPackageManager(rootDir),
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
          // Each hop gets its own frame, so the prompt can show real code at
          // every step rather than paraphrasing the engine's trace text.
          trace: finding.trace.map((step) => {
            const normalized = normalizeTraceStep(step);
            return {
              ...normalized,
              frame: hopFrame(rootDir, cache, normalized),
            };
          }),
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
    const config = antraConfigSchema.parse(await c.req.json());
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
      return c.html(renderAssetsNotBuiltHtml(), 503);
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

function renderAssetsNotBuiltHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>antra studio · assets not built</title>
    <style>
      :root {
        --bg: #f8f4f4;
        --surface: #ffffff;
        --border: rgba(32, 30, 29, 0.12);
        --text: #201e1d;
        --text-muted: #605d5d;
        --accent: #1a47ff;
        --accent-hover: #0f37d9;
        --code-bg: #eae7e7;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #141413;
          --surface: #1e1d1c;
          --border: rgba(241, 239, 238, 0.14);
          --text: #f1efee;
          --text-muted: #9b9797;
          --accent: #3b66ff;
          --accent-hover: #5d81ff;
          --code-bg: #282726;
        }
      }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1.5rem;
        box-sizing: border-box;
      }
      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        max-width: 520px;
        width: 100%;
        padding: 2.5rem;
        text-align: center;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
      }
      .icon-badge {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        background: rgba(26, 71, 255, 0.1);
        color: var(--accent);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1.25rem;
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.4rem;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      p {
        margin: 0 0 1.5rem;
        color: var(--text-muted);
        font-size: 0.95rem;
        line-height: 1.5;
      }
      .command-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--code-bg);
        border-radius: 8px;
        padding: 0.75rem 1rem;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 0.9rem;
        margin-bottom: 1.5rem;
      }
      .copy-btn {
        background: transparent;
        border: none;
        color: var(--accent);
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
      }
      .copy-btn:hover {
        background: rgba(26, 71, 255, 0.1);
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.25rem;
        font-size: 0.9rem;
        font-weight: 600;
        border-radius: 6px;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.15s;
        border: 1px solid transparent;
        background: var(--accent);
        color: #ffffff;
      }
      .btn:hover {
        background: var(--accent-hover);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-badge">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h1>Studio assets are not built</h1>
      <p>
        The Antra Studio frontend has not been compiled yet. Run <code>pnpm build:studio</code> in antra, then try again.
      </p>
      <div class="command-box">
        <code>pnpm build:studio</code>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('pnpm build:studio'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 2000)">Copy</button>
      </div>
      <div>
        <button class="btn" onclick="window.location.reload()">Reload Studio</button>
      </div>
    </div>
  </body>
</html>`;
}
