/**
 * The Studio API contract. Deliberately standalone (no imports from the
 * engine) so the browser bundle type-checks against this file alone; the
 * server maps engine types onto these shapes and TypeScript verifies they fit.
 */

export type RuleId = "BG-001" | "BG-002" | "BG-003" | "BG-004";
export type Severity = "error" | "warning";
export type FindingStatus = "active" | "suppressed" | "baselined";

export interface ScanSummary {
  id: number;
  startedAt: string;
  durationMs: number;
  framework: string;
  rules: RuleId[];
  files: number;
  schemaFields: number;
  taintSources: number;
  findings: number;
  suppressed: number;
  baselined: number;
}

export interface CodeFrame {
  startLine: number;
  lines: string[];
}

export interface FindingDetail {
  id: number;
  ruleId: RuleId;
  severity: Severity;
  file: string;
  line: number;
  column: number;
  message: string;
  snippet: string;
  trace: string[];
  fingerprint: string;
  status: FindingStatus;
  suppressReason: string | null;
  frame: CodeFrame | null;
}

export interface FileDetail {
  path: string;
  boundary: "server" | "client";
  isServerActionModule: boolean;
  isRouteHandler: boolean;
  routeMethods: string[];
  serverActions: { name: string; line: number }[];
}

export interface ScanDetail {
  scan: ScanSummary;
  findings: FindingDetail[];
  files: FileDetail[];
}

export interface ProjectInfo {
  rootDir: string;
  name: string;
  configPresent: boolean;
  version: string;
  latest: ScanSummary | null;
}

export interface SourceField {
  field: string;
  origin: string;
  /** Final verdict after keywords, pins and ignores. */
  sensitive: boolean;
  keywordHit: boolean;
  pinned: boolean;
  ignored: boolean;
}

export interface SourcesResponse {
  generatedAt: string | null;
  fields: SourceField[];
}

export interface StudioConfig {
  version: 1;
  frameworkAdapter: string;
  providers: ({ id: string } & Record<string, unknown>)[];
  keywords: { include: string[]; exclude?: string[] | undefined };
  sensitiveFields: { include: string[]; exclude: string[] };
  sanitizers: string[];
  rules: Record<string, boolean>;
}

export interface ScanRunResponse {
  scanId: number | null;
  findings: number;
  baselined: number;
  suppressed: number;
  durationMs: number;
  storeError: string | null;
}

export interface BaselineResponse {
  recorded: number;
  byRule: Record<string, number>;
  file: string;
}

export interface RuleInfo {
  id: RuleId;
  severity: Severity;
  description: string;
}
