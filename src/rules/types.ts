import type { Node, SourceFile } from "ts-morph";

import type { FileClassification } from "../ast/boundary-classifier.js";
import type { TaintResolver } from "../ast/render-graph.js";
import type { SanitizerMatcher } from "../classification/sanitizers.js";

export type RuleId = "BG-001" | "BG-002" | "BG-003" | "BG-004";
export type Severity = "error" | "warning";

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  message: string;
  filePath: string;
  line: number;
  column: number;
  /** The sink expression, first line, trimmed. */
  snippet: string;
  /** Provenance, nearest-to-sink first (empty for BG-002). */
  trace: string[];
  /** Stable identity across line shifts (rule + file + sink text); set by the engine. */
  fingerprint?: string;
  suppressed?: { reason: string | null };
}

export interface RuleContext {
  rootDir: string;
  classifications: ReadonlyMap<string, FileClassification>;
  resolver: TaintResolver;
  sanitizer: SanitizerMatcher;
}

export interface Rule {
  id: RuleId;
  severity: Severity;
  description: string;
  run(file: SourceFile, ctx: RuleContext): Finding[];
}

function firstLine(text: string, max = 120): string {
  const line = (text.split("\n")[0] ?? text).trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Builds a Finding anchored at `node`. */
export function findingAt(
  rule: Pick<Rule, "id" | "severity">,
  node: Node,
  message: string,
  trace: readonly string[] = [],
): Finding {
  const sourceFile = node.getSourceFile();
  const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
  return {
    ruleId: rule.id,
    severity: rule.severity,
    message,
    filePath: sourceFile.getFilePath(),
    line,
    column,
    snippet: firstLine(node.getText()),
    trace: [...trace],
  };
}
