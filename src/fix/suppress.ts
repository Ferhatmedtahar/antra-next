import fs from "fs";

import type { Finding, RuleId } from "../rules/types.js";

export interface SuppressionEdit {
  filePath: string;
  /** 1-based line the comment goes above. */
  line: number;
  ruleIds: RuleId[];
  /** The full line to insert, indentation included. */
  text: string;
}

const NEXT_LINE = "boundary-guard-disable-next-line";

/**
 * Picks a comment form the parser accepts where the sink line sits:
 * JSX children → `{/* … *\/}`, inside a JSX opening tag → `/* … *\/`,
 * plain statements → `// …`. The suppression matcher is a text match, so
 * any form works; this is about not breaking the file.
 */
export function commentFor(
  directive: string,
  lines: readonly string[],
  line: number,
): string {
  const current = (lines[line - 1] ?? "").trim();
  let previous = "";
  for (let index = line - 2; index >= 0; index--) {
    const candidate = (lines[index] ?? "").trim();
    if (candidate.length > 0) {
      previous = candidate;
      break;
    }
  }
  const inJsxChildren =
    (current.startsWith("<") || current.startsWith("{")) &&
    (previous.endsWith(">") || previous.startsWith("<")) &&
    !/^(return|const|let|var|export|import|if|for|while|function)\b/.test(
      current,
    );
  if (inJsxChildren) return `{/* ${directive} */}`;
  const inOpeningTag =
    /^[A-Za-z_$][\w$-]*=/.test(current) || current.startsWith("{...");
  if (inOpeningTag) return `/* ${directive} */`;
  return `// ${directive}`;
}

/**
 * One edit per file:line — findings from several rules on the same line
 * share a single directive. Findings are expected to be active (not
 * already suppressed); the file contents come from disk.
 */
export function planSuppressions(
  findings: readonly Finding[],
  reason: string,
): SuppressionEdit[] {
  const byLocation = new Map<
    string,
    { filePath: string; line: number; ruleIds: Set<RuleId> }
  >();
  for (const finding of findings) {
    const key = `${finding.filePath}\n${finding.line}`;
    const entry = byLocation.get(key) ?? {
      filePath: finding.filePath,
      line: finding.line,
      ruleIds: new Set<RuleId>(),
    };
    entry.ruleIds.add(finding.ruleId);
    byLocation.set(key, entry);
  }

  const sources = new Map<string, string[]>();
  const edits: SuppressionEdit[] = [];
  for (const { filePath, line, ruleIds } of byLocation.values()) {
    let lines = sources.get(filePath);
    if (!lines) {
      lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
      sources.set(filePath, lines);
    }
    const target = lines[line - 1] ?? "";
    const indent = /^\s*/.exec(target)?.[0] ?? "";
    const ids = [...ruleIds].sort();
    const directive = `${NEXT_LINE} ${ids.join(", ")} reason="${reason.replace(/"/g, "'")}"`;
    edits.push({
      filePath,
      line,
      ruleIds: ids,
      text: `${indent}${commentFor(directive, lines, line)}`,
    });
  }
  return edits.sort(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line,
  );
}

/** Writes the edits, bottom-up per file so line numbers stay valid. */
export async function applySuppressionEdits(
  edits: readonly SuppressionEdit[],
): Promise<{ files: number; inserted: number }> {
  const byFile = new Map<string, SuppressionEdit[]>();
  for (const edit of edits) {
    byFile.set(edit.filePath, [...(byFile.get(edit.filePath) ?? []), edit]);
  }
  let inserted = 0;
  for (const [filePath, fileEdits] of byFile) {
    const original = await fs.promises.readFile(filePath, "utf8");
    const newline = original.includes("\r\n") ? "\r\n" : "\n";
    const lines = original.split(/\r?\n/);
    for (const edit of [...fileEdits].sort((a, b) => b.line - a.line)) {
      lines.splice(edit.line - 1, 0, edit.text);
      inserted++;
    }
    await fs.promises.writeFile(filePath, lines.join(newline), "utf8");
  }
  return { files: byFile.size, inserted };
}
