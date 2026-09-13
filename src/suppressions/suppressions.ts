import type { Finding, RuleId } from "../rules/types.js";

/**
 * `// antra-disable-next-line BG-001, BG-003 reason="why"` on the
 * line above a finding, or `antra-disable-line` on the same line.
 * Works inside JSX comments too (`{/* ... *\/}`) — it's a plain text match.
 * Rule list optional (none = all rules); reason optional but recorded.
 */
const NEXT_LINE =
  /antra-disable-next-line(?:\s+([A-Z]+-\d+(?:\s*,\s*[A-Z]+-\d+)*))?(?:\s+reason=(?:"([^"]*)"|'([^']*)'))?/;
const SAME_LINE =
  /antra-disable-line(?:\s+([A-Z]+-\d+(?:\s*,\s*[A-Z]+-\d+)*))?(?:\s+reason=(?:"([^"]*)"|'([^']*)'))?/;

export interface SuppressionResult {
  active: Finding[];
  suppressed: Finding[];
}

function matchDirective(
  text: string | undefined,
  pattern: RegExp,
  ruleId: RuleId,
): { reason: string | null } | null {
  if (!text) return null;
  const match = pattern.exec(text);
  if (!match) return null;
  const [, ruleList, doubleQuoted, singleQuoted] = match;
  const ruleIds = ruleList?.split(/\s*,\s*/).map((id) => id.trim());
  if (ruleIds && !ruleIds.includes(ruleId)) return null;
  return { reason: doubleQuoted ?? singleQuoted ?? null };
}

/** Splits findings into active and suppressed using the source text of each file. */
export function applySuppressions(
  findings: readonly Finding[],
  getSourceText: (filePath: string) => string | undefined,
): SuppressionResult {
  const active: Finding[] = [];
  const suppressed: Finding[] = [];
  const lineCache = new Map<string, string[]>();

  for (const finding of findings) {
    let lines = lineCache.get(finding.filePath);
    if (!lines) {
      lines = (getSourceText(finding.filePath) ?? "").split(/\r?\n/);
      lineCache.set(finding.filePath, lines);
    }
    const suppression =
      matchDirective(lines[finding.line - 2], NEXT_LINE, finding.ruleId) ??
      matchDirective(lines[finding.line - 1], SAME_LINE, finding.ruleId);
    if (suppression) {
      suppressed.push({ ...finding, suppressed: suppression });
    } else {
      active.push(finding);
    }
  }
  return { active, suppressed };
}
