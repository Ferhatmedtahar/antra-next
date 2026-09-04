import type { SourceFile } from "ts-morph";

import { bg001 } from "./bg-001.js";
import { bg002 } from "./bg-002.js";
import { bg003 } from "./bg-003.js";
import { bg004 } from "./bg-004.js";
import type { Finding, Rule, RuleContext, RuleId } from "./types.js";

export type { Finding, Rule, RuleContext, RuleId, Severity } from "./types.js";

/** Every rule the engine knows. Adding one = adding an entry; the runner never changes. */
export const rules: readonly Rule[] = [bg001, bg002, bg003, bg004];

export const RULE_IDS: readonly RuleId[] = rules.map((rule) => rule.id);

export function isRuleId(value: string): value is RuleId {
  return (RULE_IDS as readonly string[]).includes(value);
}

/** Runs the enabled rules over every file; findings sorted by file, line, column. */
export function runRules(
  files: readonly SourceFile[],
  ctx: RuleContext,
  enabled: readonly Rule[] = rules,
): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    for (const rule of enabled) findings.push(...rule.run(file, ctx));
  }
  return findings.sort(
    (a, b) =>
      a.filePath.localeCompare(b.filePath) ||
      a.line - b.line ||
      a.column - b.column ||
      a.ruleId.localeCompare(b.ruleId),
  );
}
