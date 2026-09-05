import fs from "fs";
import path from "path";

import { Chalk, type ChalkInstance } from "chalk";

import type { ScanResult } from "../engine.js";
import type { Finding } from "../rules/types.js";
import type { ReportContext, Reporter } from "./types.js";

/** Per-section cap in the summary; --verbose lifts it. */
const PREVIEW_LIMIT = 10;
const FRAME_CONTEXT = 1;

function countByRule(findings: readonly Finding[]): string {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruleId, count]) => `${ruleId} ×${count}`)
    .join(", ");
}

export class SourceCache {
  private readonly lines = new Map<string, string[] | null>();

  get(filePath: string): string[] | null {
    if (!this.lines.has(filePath)) {
      try {
        this.lines.set(
          filePath,
          fs.readFileSync(filePath, "utf8").split(/\r?\n/),
        );
      } catch {
        this.lines.set(filePath, null);
      }
    }
    return this.lines.get(filePath) ?? null;
  }
}

/**
 * A short code frame around the sink, with the sink underlined:
 *
 *     15 |     <main>
 *   > 16 |       <ClientCard hash={user.password_hash} />
 *        |                   ^^^^^^^^^^^^^^^^^^^^^^^^^
 */
export function codeFrame(
  finding: Finding,
  lines: string[],
  c: ChalkInstance,
): string[] {
  const first = Math.max(1, finding.line - FRAME_CONTEXT);
  const last = Math.min(lines.length, finding.line + FRAME_CONTEXT);
  const width = String(last).length;
  const out: string[] = [];
  for (let n = first; n <= last; n++) {
    const text = lines[n - 1] ?? "";
    const gutter = String(n).padStart(width);
    if (n === finding.line) {
      out.push(c.red(`  > ${gutter} | `) + text);
      const sinkLength = Math.max(
        1,
        Math.min(finding.snippet.length, text.length - finding.column + 1),
      );
      out.push(
        c.red(
          `    ${" ".repeat(width)} | ${" ".repeat(finding.column - 1)}${"^".repeat(sinkLength)}`,
        ),
      );
    } else {
      out.push(c.gray(`    ${gutter} | ${text}`));
    }
  }
  return out;
}

function renderSummary(
  result: ScanResult,
  ctx: ReportContext,
  c: ChalkInstance,
): string[] {
  const relative = (filePath: string) => path.relative(ctx.rootDir, filePath);
  const out: string[] = [];
  const list = (lines: readonly string[]) => {
    const shown = ctx.verbose ? lines : lines.slice(0, PREVIEW_LIMIT);
    for (const line of shown) out.push(c.gray(`    ${line}`));
    if (lines.length > shown.length) {
      out.push(
        c.gray(
          `    … and ${lines.length - shown.length} more (--verbose or --format json for all)`,
        ),
      );
    }
  };

  const clients = result.classifications.filter((f) => f.boundary === "client");
  const routes = result.classifications.filter((f) => f.isRouteHandler);
  const actions = result.classifications.flatMap((f) =>
    f.serverActions.map((action) => ({ file: f.filePath, ...action })),
  );

  out.push(c.blue.bold("boundary-guard scan"));
  out.push(c.gray(`project:   ${ctx.rootDir}`));
  out.push(c.gray(`framework: ${result.frameworkAdapter}`));
  out.push(
    c.gray(`rules:     ${result.rulesRun.join(", ") || "(none enabled)"}`),
  );
  if (result.scope.partial) {
    out.push(
      c.yellow(
        `scope:     ${result.scope.label} — rules ran on ${result.scope.files} file(s); not recorded`,
      ),
    );
  }
  out.push(c.gray(`duration:  ${(result.durationMs / 1000).toFixed(1)}s`));
  out.push("");

  if (result.configPresent) {
    out.push(
      `  taint sources:     ${result.taintSources.length} sensitive of ${result.schemaFields.length} schema field(s)`,
    );
    list(result.taintSources.map((source) => source.origin));
  } else {
    out.push(
      c.yellow(
        "  taint sources:     none — no boundary-guard.config.json; run `boundary-guard init` (zero-schema heuristics only)",
      ),
    );
  }
  out.push(`  files scanned:     ${result.classifications.length}`);
  out.push(`  client boundaries: ${clients.length}`);
  list(clients.map((f) => relative(f.filePath)));
  out.push(`  server actions:    ${actions.length}`);
  list(actions.map((a) => `${relative(a.file)}:${a.line}  ${a.name}`));
  out.push(`  route handlers:    ${routes.length}`);
  list(
    routes.map(
      (r) => `${relative(r.filePath)}  [${r.routeMethods.join(", ")}]`,
    ),
  );
  return out;
}

export function renderFindings(
  result: ScanResult,
  ctx: ReportContext,
  c: ChalkInstance,
): string[] {
  const relative = (filePath: string) => path.relative(ctx.rootDir, filePath);
  const sources = new SourceCache();
  const out: string[] = [""];

  if (result.findings.length === 0) {
    out.push(c.green.bold("✓ no new findings"));
  } else {
    out.push(
      c.red.bold(
        `✖ ${result.findings.length} finding(s)  [${countByRule(result.findings)}]`,
      ),
    );
  }
  if (result.baselined.length > 0) {
    out.push(
      c.gray(
        `  ${result.baselined.length} baselined (pre-existing — \`boundary-guard baseline\` to refresh)`,
      ),
    );
  }
  if (result.suppressed.length > 0) {
    out.push(
      c.gray(`  ${result.suppressed.length} suppressed by inline comment`),
    );
  }

  let lastFile = "";
  for (const finding of result.findings) {
    if (finding.filePath !== lastFile) {
      out.push("", c.bold(relative(finding.filePath)));
      lastFile = finding.filePath;
    }
    const severity =
      finding.severity === "error" ? c.red("error") : c.yellow("warn ");
    out.push(
      `  ${c.gray(`${finding.line}:${finding.column}`)}  ${severity}  ${c.cyan(finding.ruleId)}  ${finding.message}`,
    );
    const lines = sources.get(finding.filePath);
    if (lines) out.push(...codeFrame(finding, lines, c));
    else out.push(c.gray(`        ${finding.snippet}`));
    for (const step of finding.trace) out.push(c.gray(`        ↳ ${step}`));
  }
  if (result.storeError) {
    out.push("", c.yellow(`  (not recorded: ${result.storeError})`));
  }
  return out;
}

export const terminalReporter: Reporter = {
  format: "pretty",
  render(result, ctx) {
    const c = new Chalk(ctx.color ? {} : { level: 0 });
    return [
      ...renderSummary(result, ctx, c),
      ...renderFindings(result, ctx, c),
    ].join("\n");
  },
};
