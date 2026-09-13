import fs from "fs";
import path from "path";

import Database from "better-sqlite3";

import { loadProject } from "../ast/project.js";
import { loadBaseline } from "../baseline/baseline.js";
import {
  classifySources,
  sensitivityFromConfig,
} from "../classification/classify.js";
import { GITIGNORE_MARKER } from "../config/gitignore.js";
import { loadConfig, loadSnapshot } from "../config/load.js";
import { CONFIG_FILENAME, configPath, snapshotPath } from "../config/write.js";
import { detectFramework } from "../framework/detect.js";
import { rules } from "../rules/index.js";
import { findProvider } from "../schema/providers/index.js";
import { dbPath } from "../storage/db.js";

export type CheckStatus = "ok" | "warn" | "fail";

export interface DoctorCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** What to do about a warn/fail. */
  hint?: string | undefined;
}

export interface DoctorReport {
  rootDir: string;
  checks: DoctorCheck[];
  ok: number;
  warn: number;
  fail: number;
  /** No failed checks. Warnings don't count — zero-schema mode is legal. */
  healthy: boolean;
}

const MIN_NODE_MAJOR = 20;

/** Provider settings that name a file the extractor will open. */
function providerPaths(provider: Record<string, unknown>): string[] {
  return Object.entries(provider).flatMap(([key, value]) =>
    key !== "id" &&
    typeof value === "string" &&
    /path|file|spec|schema/i.test(key) &&
    !/^https?:/i.test(value)
      ? [value]
      : [],
  );
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? (error.message.split("\n")[0] ?? "")
    : String(error);
}

function ageOf(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * `doctor`: every precondition a scan relies on, checked one by one with a
 * concrete hint per problem. Never throws — a broken project is the point.
 */
export async function runDoctor(rootDir: string): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const add = (check: DoctorCheck) => checks.push(check);

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  add({
    id: "node",
    label: "Node.js",
    status: nodeMajor >= MIN_NODE_MAJOR ? "ok" : "fail",
    detail: `v${process.versions.node}`,
    hint:
      nodeMajor >= MIN_NODE_MAJOR
        ? undefined
        : `antra needs Node ${MIN_NODE_MAJOR} or newer.`,
  });

  const adapter = await detectFramework(rootDir);
  add({
    id: "framework",
    label: "Framework",
    status: adapter ? "ok" : "fail",
    detail: adapter
      ? `${adapter.id} · source root ${path.relative(rootDir, adapter.findSourceRoot(rootDir)) || "."}`
      : "no Next.js App Router project detected",
    hint: adapter
      ? undefined
      : "Expected next.config.*, an app/ or src/app/ directory, and next in package.json.",
  });

  const configFile = configPath(rootDir);
  let config = null;
  if (!fs.existsSync(configFile)) {
    add({
      id: "config",
      label: "Config",
      status: "warn",
      detail: `no ${CONFIG_FILENAME} — zero-schema heuristics only`,
      hint: "Run `antra init` to pick a schema provider and seed the sensitive fields.",
    });
  } else {
    try {
      config = await loadConfig(rootDir);
      add({
        id: "config",
        label: "Config",
        status: "ok",
        detail: `${CONFIG_FILENAME} · ${config.providers.length} provider(s) · ${config.keywords.include.length} keyword(s) · ${config.sensitiveFields.include.length} pinned · ${config.sensitiveFields.exclude.length} ignored`,
      });
    } catch (error) {
      add({
        id: "config",
        label: "Config",
        status: "fail",
        detail: `${CONFIG_FILENAME} is invalid: ${describeError(error)}`,
        hint: "Fix the file by hand or re-run `antra init` and accept the overwrite.",
      });
    }
  }

  if (config) {
    const problems: string[] = [];
    for (const provider of config.providers) {
      if (!findProvider(provider.id)) {
        problems.push(`unknown provider "${provider.id}"`);
        continue;
      }
      for (const file of providerPaths(provider)) {
        if (!fs.existsSync(path.resolve(rootDir, file))) {
          problems.push(`${provider.id}: ${file} not found`);
        }
      }
    }
    add({
      id: "providers",
      label: "Providers",
      status:
        problems.length > 0
          ? "fail"
          : config.providers.length === 0
            ? "warn"
            : "ok",
      detail:
        problems.length > 0
          ? problems.join("; ")
          : config.providers.length === 0
            ? "none configured — schema fields come from nothing but keywords"
            : config.providers.map((provider) => provider.id).join(", "),
      hint:
        problems.length > 0
          ? "Re-run `antra init` to point the provider at the right file."
          : config.providers.length === 0
            ? "Run `antra init` and pick a provider to get real taint sources."
            : undefined,
    });

    const snapshotFile = snapshotPath(rootDir);
    let snapshot = null;
    if (!fs.existsSync(snapshotFile)) {
      add({
        id: "snapshot",
        label: "Snapshot",
        status: "fail",
        detail: `${path.relative(rootDir, snapshotFile)} is missing`,
        hint: "Run `antra sync`.",
      });
    } else {
      try {
        snapshot = await loadSnapshot(rootDir);
      } catch (error) {
        add({
          id: "snapshot",
          label: "Snapshot",
          status: "fail",
          detail: `snapshot is invalid: ${describeError(error)}`,
          hint: "Run `antra sync` to rewrite it.",
        });
      }
    }
    if (snapshot) {
      const generated = new Date(snapshot.generatedAt).getTime();
      const newer = config.providers.flatMap((provider) =>
        providerPaths(provider).filter((file) => {
          try {
            return fs.statSync(path.resolve(rootDir, file)).mtimeMs > generated;
          } catch {
            return false;
          }
        }),
      );
      add({
        id: "snapshot",
        label: "Snapshot",
        status: newer.length > 0 ? "warn" : "ok",
        detail:
          `${snapshot.sources.length} field(s), generated ${ageOf(snapshot.generatedAt)}` +
          (newer.length > 0 ? ` — older than ${newer.join(", ")}` : ""),
        hint:
          newer.length > 0
            ? "The schema changed since the last sync; run `antra sync`."
            : undefined,
      });

      const sensitive = classifySources(
        snapshot.sources,
        sensitivityFromConfig(config),
      );
      add({
        id: "sensitivity",
        label: "Sensitive fields",
        status:
          sensitive.length === 0 && snapshot.sources.length > 0 ? "warn" : "ok",
        detail: `${sensitive.length} of ${snapshot.sources.length} schema field(s) are taint origins`,
        hint:
          sensitive.length === 0 && snapshot.sources.length > 0
            ? "No field matched a keyword. Add keywords in your language or pin fields in sensitiveFields.include."
            : undefined,
      });
    }

    const enabled = rules.filter((rule) => config.rules[rule.id] !== false);
    add({
      id: "rules",
      label: "Rules",
      status: enabled.length === 0 ? "fail" : "ok",
      detail:
        enabled.length === 0
          ? "every rule is switched off"
          : `${enabled.map((rule) => rule.id).join(", ")} enabled` +
            (enabled.length < rules.length
              ? ` (${rules.length - enabled.length} off)`
              : ""),
      hint:
        enabled.length === 0
          ? "Turn a rule back on in the config or Studio; a scan with no rules finds nothing."
          : undefined,
    });
  }

  try {
    const baseline = await loadBaseline(rootDir);
    add({
      id: "baseline",
      label: "Baseline",
      status: baseline ? "ok" : "warn",
      detail: baseline
        ? `${baseline.fingerprints.length} accepted finding(s), recorded ${ageOf(baseline.generatedAt)}`
        : "none — every finding fails the gate",
      hint: baseline
        ? undefined
        : "Adopting on an existing codebase? Run `antra baseline` and commit .antra/baseline.json.",
    });
  } catch (error) {
    add({
      id: "baseline",
      label: "Baseline",
      status: "fail",
      detail: `baseline.json is invalid: ${describeError(error)}`,
      hint: "Delete it and run `antra baseline` again.",
    });
  }

  const gitignore = path.join(rootDir, ".gitignore");
  const hasBlock =
    fs.existsSync(gitignore) &&
    fs.readFileSync(gitignore, "utf8").includes(GITIGNORE_MARKER);
  add({
    id: "gitignore",
    label: ".gitignore",
    status: hasBlock ? "ok" : "warn",
    detail: hasBlock
      ? "managed block present — antra-findings.sqlite stays out of git"
      : "no antra block — antra-findings.sqlite could be committed",
    hint: hasBlock
      ? undefined
      : "Run `antra init` (it appends the block) or ignore .antra/*.sqlite* yourself.",
  });

  const database = dbPath(rootDir);
  if (!fs.existsSync(database)) {
    add({
      id: "database",
      label: "Scan history",
      status: "ok",
      detail: "no scans recorded yet",
    });
  } else {
    try {
      const db = new Database(database, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        const row = db
          .prepare("SELECT COUNT(*) AS n, MAX(started_at) AS last FROM scans")
          .get() as { n: number; last: string | null };
        add({
          id: "database",
          label: "Scan history",
          status: "ok",
          detail: `${row.n} scan(s) in antra-findings.sqlite${row.last ? `, last ${ageOf(row.last)}` : ""}`,
        });
      } finally {
        db.close();
      }
    } catch (error) {
      add({
        id: "database",
        label: "Scan history",
        status: "warn",
        detail: `antra-findings.sqlite can't be opened: ${describeError(error)}`,
        hint: "Delete .antra/antra-findings.sqlite; the next scan recreates it.",
      });
    }
  }

  try {
    const started = Date.now();
    const { sourceFiles } = loadProject(rootDir);
    const elapsed = Date.now() - started;
    const tsconfig = fs.existsSync(path.join(rootDir, "tsconfig.json"));
    add({
      id: "parser",
      label: "Parser",
      status: sourceFiles.length === 0 ? "fail" : "ok",
      detail:
        sourceFiles.length === 0
          ? "no .ts/.tsx/.js/.jsx files found"
          : `${sourceFiles.length} source file(s) parsed in ${(elapsed / 1000).toFixed(1)}s` +
            (tsconfig
              ? " using tsconfig.json"
              : " (no tsconfig.json — path aliases won't resolve)"),
      hint:
        sourceFiles.length === 0
          ? "Point antra at the app root, not a parent directory."
          : undefined,
    });
  } catch (error) {
    add({
      id: "parser",
      label: "Parser",
      status: "fail",
      detail: `could not load the project: ${describeError(error)}`,
    });
  }

  const count = (status: CheckStatus) =>
    checks.filter((check) => check.status === status).length;
  return {
    rootDir,
    checks,
    ok: count("ok"),
    warn: count("warn"),
    fail: count("fail"),
    healthy: count("fail") === 0,
  };
}
