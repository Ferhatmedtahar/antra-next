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

export interface TraceStep {
  text: string;
  file?: string;
  line?: number;
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
  trace: (TraceStep | string)[];
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

export type GraphNodeKind = "server" | "client" | "action" | "route";
export type GraphEdgeKind = "renders" | "calls-action";

export interface GraphNode {
  /** The relative path — also the id. */
  id: string;
  path: string;
  kind: GraphNodeKind;
  boundary: "server" | "client";
  serverActions: string[];
  routeMethods: string[];
  /** Non-suppressed findings in this file. */
  findings: number;
  newFindings: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: GraphEdgeKind;
  /** Component tags or action names carried by the edge. */
  names: string[];
  count: number;
  /** Server → client render, or a client file calling a server action. */
  crossing: boolean;
  /** BG-001/BG-003 findings whose sink is a component on this edge. */
  findings: number;
  newFindings: number;
}

export interface GraphResponse {
  scanId: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
