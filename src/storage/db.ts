import fs from "fs";
import path from "path";

import { openSqliteDatabase, type SqliteDatabase } from "./sqlite.js";

import { SNAPSHOT_DIR } from "../config/write.js";
import type { EdgeKind } from "../ast/boundary-graph.js";
import type { ScanResult } from "../engine.js";
import {
  normalizeTraceStep,
  type Finding,
  type RuleId,
  type Severity,
  type TraceStep,
} from "../rules/types.js";

export const DB_FILENAME = "antra-findings.sqlite";

export function dbPath(rootDir: string): string {
  return path.join(rootDir, SNAPSHOT_DIR, DB_FILENAME);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  root_dir TEXT NOT NULL,
  framework TEXT NOT NULL,
  rules TEXT NOT NULL,
  files INTEGER NOT NULL,
  schema_fields INTEGER NOT NULL,
  taint_sources INTEGER NOT NULL,
  findings INTEGER NOT NULL,
  suppressed INTEGER NOT NULL,
  baselined INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  boundary TEXT NOT NULL,
  is_action_module INTEGER NOT NULL,
  is_route_handler INTEGER NOT NULL,
  route_methods TEXT NOT NULL,
  server_actions TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS taint_sources (
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  origin TEXT NOT NULL,
  sensitive INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  file TEXT NOT NULL,
  line INTEGER NOT NULL,
  column INTEGER NOT NULL,
  message TEXT NOT NULL,
  snippet TEXT NOT NULL,
  trace TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  suppress_reason TEXT
);
CREATE TABLE IF NOT EXISTS edges (
  scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  kind TEXT NOT NULL,
  names TEXT NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS findings_scan ON findings(scan_id);
CREATE INDEX IF NOT EXISTS edges_scan ON edges(scan_id);
CREATE INDEX IF NOT EXISTS files_scan ON files(scan_id);
`;

export type FindingStatus = "active" | "suppressed" | "baselined";

export interface StoredScan {
  id: number;
  startedAt: string;
  durationMs: number;
  rootDir: string;
  framework: string;
  rules: RuleId[];
  files: number;
  schemaFields: number;
  taintSources: number;
  findings: number;
  suppressed: number;
  baselined: number;
}

export interface StoredFinding {
  id: number;
  scanId: number;
  ruleId: RuleId;
  severity: Severity;
  /** Relative to the scanned project root. */
  file: string;
  line: number;
  column: number;
  message: string;
  snippet: string;
  trace: TraceStep[];
  fingerprint: string;
  status: FindingStatus;
  suppressReason: string | null;
}

export interface StoredEdge {
  /** Relative to the scanned project root. */
  from: string;
  to: string;
  kind: EdgeKind;
  names: string[];
  count: number;
}

interface EdgeRow {
  from_path: string;
  to_path: string;
  kind: EdgeKind;
  names: string;
  count: number;
}

function toEdge(row: EdgeRow): StoredEdge {
  return {
    from: row.from_path,
    to: row.to_path,
    kind: row.kind,
    names: JSON.parse(row.names) as string[],
    count: row.count,
  };
}

export interface StoredFile {
  /** Relative to the scanned project root. */
  path: string;
  boundary: "server" | "client";
  isServerActionModule: boolean;
  isRouteHandler: boolean;
  routeMethods: string[];
  serverActions: { name: string; line: number }[];
}

interface FileRow {
  path: string;
  boundary: "server" | "client";
  is_action_module: number;
  is_route_handler: number;
  route_methods: string;
  server_actions: string;
}

function toFile(row: FileRow): StoredFile {
  return {
    path: row.path,
    boundary: row.boundary,
    isServerActionModule: row.is_action_module === 1,
    isRouteHandler: row.is_route_handler === 1,
    routeMethods: JSON.parse(row.route_methods) as string[],
    serverActions: JSON.parse(row.server_actions) as {
      name: string;
      line: number;
    }[],
  };
}

interface ScanRow {
  id: number;
  started_at: string;
  duration_ms: number;
  root_dir: string;
  framework: string;
  rules: string;
  files: number;
  schema_fields: number;
  taint_sources: number;
  findings: number;
  suppressed: number;
  baselined: number;
}

interface FindingRow {
  id: number;
  scan_id: number;
  rule_id: RuleId;
  severity: Severity;
  file: string;
  line: number;
  column: number;
  message: string;
  snippet: string;
  trace: string;
  fingerprint: string;
  status: FindingStatus;
  suppress_reason: string | null;
}

function toScan(row: ScanRow): StoredScan {
  return {
    id: row.id,
    startedAt: row.started_at,
    durationMs: row.duration_ms,
    rootDir: row.root_dir,
    framework: row.framework,
    rules: JSON.parse(row.rules) as RuleId[],
    files: row.files,
    schemaFields: row.schema_fields,
    taintSources: row.taint_sources,
    findings: row.findings,
    suppressed: row.suppressed,
    baselined: row.baselined,
  };
}

function toFinding(row: FindingRow): StoredFinding {
  const parsed = JSON.parse(row.trace) as (TraceStep | string)[];
  return {
    id: row.id,
    scanId: row.scan_id,
    ruleId: row.rule_id,
    severity: row.severity,
    file: row.file,
    line: row.line,
    column: row.column,
    message: row.message,
    snippet: row.snippet,
    trace: parsed.map(normalizeTraceStep),
    fingerprint: row.fingerprint,
    status: row.status,
    suppressReason: row.suppress_reason,
  };
}

/**
 * D1 in docs/c4: every scan appended to `.antra/antra-findings.sqlite`
 * (gitignored by `init`). Reporters and Studio read from here; nothing
 * else in the pipeline depends on it.
 */
export class FindingsStore {
  private readonly db: SqliteDatabase;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = openSqliteDatabase(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
  }

  static open(rootDir: string): FindingsStore {
    return new FindingsStore(dbPath(rootDir));
  }

  /** Records a scan with its files, taint sources and every finding (any status). Returns the scan id. */
  saveScan(result: ScanResult, rootDir: string): number {
    const relative = (filePath: string) => path.relative(rootDir, filePath);
    const insertScan = this.db.prepare(
      `INSERT INTO scans (started_at, duration_ms, root_dir, framework, rules, files, schema_fields, taint_sources, findings, suppressed, baselined)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertFile = this.db.prepare(
      `INSERT INTO files (scan_id, path, boundary, is_action_module, is_route_handler, route_methods, server_actions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertSource = this.db.prepare(
      `INSERT INTO taint_sources (scan_id, field, origin, sensitive) VALUES (?, ?, ?, ?)`,
    );
    const insertFinding = this.db.prepare(
      `INSERT INTO findings (scan_id, rule_id, severity, file, line, column, message, snippet, trace, fingerprint, status, suppress_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertEdge = this.db.prepare(
      `INSERT INTO edges (scan_id, from_path, to_path, kind, names, count) VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const sensitiveOrigins = new Set(result.taintSources.map((s) => s.origin));
    return this.db.transaction((): number => {
      const scanId = Number(
        insertScan.run(
          result.startedAt,
          result.durationMs,
          rootDir,
          result.frameworkAdapter,
          JSON.stringify(result.rulesRun),
          result.classifications.length,
          result.schemaFields.length,
          result.taintSources.length,
          result.findings.length,
          result.suppressed.length,
          result.baselined.length,
        ).lastInsertRowid,
      );
      for (const file of result.classifications) {
        insertFile.run(
          scanId,
          relative(file.filePath),
          file.boundary,
          file.isServerActionModule ? 1 : 0,
          file.isRouteHandler ? 1 : 0,
          JSON.stringify(file.routeMethods),
          JSON.stringify(file.serverActions),
        );
      }
      for (const source of result.schemaFields) {
        insertSource.run(
          scanId,
          source.field,
          source.origin,
          sensitiveOrigins.has(source.origin) ? 1 : 0,
        );
      }
      const rows: [Finding, FindingStatus][] = [
        ...result.findings.map((f): [Finding, FindingStatus] => [f, "active"]),
        ...result.suppressed.map((f): [Finding, FindingStatus] => [
          f,
          "suppressed",
        ]),
        ...result.baselined.map((f): [Finding, FindingStatus] => [
          f,
          "baselined",
        ]),
      ];
      for (const [finding, status] of rows) {
        insertFinding.run(
          scanId,
          finding.ruleId,
          finding.severity,
          relative(finding.filePath),
          finding.line,
          finding.column,
          finding.message,
          finding.snippet,
          JSON.stringify(finding.trace),
          finding.fingerprint ?? "",
          status,
          finding.suppressed?.reason ?? null,
        );
      }
      for (const edge of result.edges) {
        insertEdge.run(
          scanId,
          relative(edge.from),
          relative(edge.to),
          edge.kind,
          JSON.stringify(edge.names),
          edge.count,
        );
      }
      return scanId;
    });
  }

  listScans(limit = 20): StoredScan[] {
    return this.db
      .prepare<ScanRow>(`SELECT * FROM scans ORDER BY id DESC LIMIT ?`)
      .all(limit)
      .map(toScan);
  }

  latestScan(): StoredScan | null {
    return this.listScans(1)[0] ?? null;
  }

  findingsForScan(scanId: number): StoredFinding[] {
    return this.db
      .prepare<FindingRow>(
        `SELECT * FROM findings WHERE scan_id = ? ORDER BY file, line, column, rule_id`,
      )
      .all(scanId)
      .map(toFinding);
  }

  filesForScan(scanId: number): StoredFile[] {
    return this.db
      .prepare<FileRow>(
        `SELECT path, boundary, is_action_module, is_route_handler, route_methods, server_actions
         FROM files WHERE scan_id = ? ORDER BY path`,
      )
      .all(scanId)
      .map(toFile);
  }

  edgesForScan(scanId: number): StoredEdge[] {
    return this.db
      .prepare<EdgeRow>(
        "SELECT from_path, to_path, kind, names, count FROM edges WHERE scan_id = ? ORDER BY from_path, to_path, kind",
      )
      .all(scanId)
      .map(toEdge);
  }

  close(): void {
    this.db.close();
  }
}
