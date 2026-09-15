/**
 * Renders a finding into a self-contained brief for an AI coding agent.
 *
 * Pure and browser-safe: no filesystem, no engine imports. The Studio bundle
 * calls this directly — the finding detail it already fetches carries
 * everything the prompt needs, including the per-hop code frames the server
 * attaches in `server.ts`.
 */

import { runPrefix } from "../utils/package-manager.js";
import { GUIDANCE } from "./rule-guidance.js";
import type {
  CodeFrame,
  FindingDetail,
  ProjectInfo,
  ScanSummary,
  TraceStep,
} from "./types.js";

const FENCE = "```";

/** `file:line:column`, or `file:line` when there is no column. */
function loc(target: { file: string; line: number; column?: number }): string {
  return target.column === undefined
    ? `${target.file}:${target.line}`
    : `${target.file}:${target.line}:${target.column}`;
}

/** A line-numbered code fence. Returns "" for an empty frame. */
function fenced(frame: CodeFrame, lang = ""): string {
  if (frame.lines.length === 0) return "";
  const last = frame.startLine + frame.lines.length - 1;
  const width = String(last).length;
  const body = frame.lines
    .map(
      (line, index) =>
        `${String(frame.startLine + index).padStart(width)} | ${line}`,
    )
    .join("\n");
  return `${FENCE}${lang}\n${body}\n${FENCE}`;
}

/**
 * Hop blocks read origin → sink; the engine stores nearest-to-sink first, so
 * this reverses — the same order the sheet's TracePath uses.
 */
function traceSection(finding: FindingDetail): string | null {
  if (finding.trace.length === 0) return null;

  const hops = [...finding.trace].reverse();
  const blocks = hops.map((raw, index) => {
    const step: TraceStep = typeof raw === "string" ? { text: raw } : raw;
    const position = index === 0 ? "origin" : `step ${index}`;
    const where = step.file
      ? `\`${step.file}${step.line ? `:${step.line}` : ""}\``
      : "no location recorded";
    const lines = [`#### ${index + 1}. ${where} — ${position}`, step.text];
    if (step.frame) {
      const code = fenced(step.frame, "ts");
      if (code) lines.push("", code);
    }
    return lines.join("\n");
  });

  const sinkLines = [
    `#### ${hops.length + 1}. \`${loc(finding)}\` — sink`,
    finding.snippet,
  ];
  if (finding.frame) {
    const code = fenced(finding.frame, "tsx");
    if (code) sinkLines.push("", code);
  }
  blocks.push(sinkLines.join("\n"));

  return ["### How the data traveled", blocks.join("\n\n")].join("\n\n");
}

const CONSTRAINTS = [
  "### Constraints",
  "- Preserve the server/client boundary — do not move server-only data into a",
  '  `"use client"` module to silence the warning.',
  "- Do not add an antra suppression comment. Fix the flow.",
  "- Change only the files listed above unless the fix requires another.",
].join("\n");

/** What "it still works" means per rule — the check is not the same for all four. */
const VERIFY: Record<string, string> = {
  "BG-001": "- The component still renders the non-sensitive value it needs.",
  "BG-002": "- The action still accepts the legitimate payloads it did before.",
  "BG-003":
    "- The Client Component still renders correctly with the projected fields.",
  "BG-004": "- The page still renders without the secret in the markup.",
};

function doneWhen(finding: FindingDetail, project: ProjectInfo): string {
  const lines = [
    "### Done when",
    `- \`${runPrefix(project.packageManager)} antra scan --fail-on error\` exits 0.`,
    `- ${finding.ruleId} no longer reports at \`${loc(finding)}\`.`,
  ];
  const verify = VERIFY[finding.ruleId];
  if (verify) lines.push(verify);
  return lines.join("\n");
}

function renderFindingBody(
  finding: FindingDetail,
  project: ProjectInfo,
  includeTail: boolean,
): string {
  const parts: string[] = [
    `## Security finding: ${finding.ruleId} (${finding.severity})`,
    `\`${loc(finding)}\``,
  ];

  const guide = GUIDANCE[finding.ruleId];
  if (guide) {
    const why = [
      "### Why Antra flagged this",
      `**${guide.title}** — ${guide.tagline}`,
      "",
      guide.whyItMatters,
    ];
    // An agent that reads this as a typing problem will "fix" it with a type
    // annotation and leave the leak in place, so the correction stays.
    if (guide.isTypeError) {
      why.push(
        "",
        `**A type annotation will not fix this.** ${guide.isTypeError}`,
      );
    }
    parts.push(why.join("\n"));
  }

  const trace = traceSection(finding);
  if (trace) parts.push(trace);

  if (guide) {
    const [recommended, ...others] = guide.options;
    if (recommended) {
      const fix = ["### Required fix", recommended.description];
      if (recommended.after) {
        fix.push("", `${FENCE}tsx\n${recommended.after}\n${FENCE}`);
      }
      parts.push(fix.join("\n"));
    }
    if (others.length > 0) {
      parts.push(
        [
          "### Other approaches Antra accepts",
          ...others.map(
            (option) => `- **${option.title}**: ${option.description}`,
          ),
        ].join("\n"),
      );
    }
  }

  if (includeTail) {
    parts.push(CONSTRAINTS);
    parts.push(doneWhen(finding, project));
    parts.push(`Finding fingerprint: \`${finding.fingerprint}\``);
  }

  return parts.join("\n\n");
}

export function renderFindingPrompt(
  finding: FindingDetail,
  project: ProjectInfo,
): string {
  return `${renderFindingBody(finding, project, true)}\n`;
}

export function renderPlanPrompt(input: {
  project: ProjectInfo;
  scan: ScanSummary;
  findings: FindingDetail[];
}): string {
  const { project, scan, findings } = input;

  if (findings.length === 0) {
    return "## Antra remediation plan — 0 findings\n\nNothing to fix.\n";
  }

  const parts: string[] = [];

  const histogram = new Map<string, number>();
  for (const finding of findings) {
    histogram.set(finding.ruleId, (histogram.get(finding.ruleId) ?? 0) + 1);
  }

  parts.push(
    `## Antra remediation plan — ${findings.length} finding${
      findings.length === 1 ? "" : "s"
    }`,
  );
  parts.push(
    [
      `Project: \`${project.name}\` (\`${project.rootDir}\`)`,
      `Scan #${scan.id}, ${scan.startedAt}`,
      `Rules: ${[...histogram]
        .map(([id, count]) => `${id} ×${count}`)
        .join(", ")}`,
    ].join("\n"),
  );

  // Grouped by file so one agent session batches per-file work instead of
  // thrashing between files.
  const byFile = new Map<string, FindingDetail[]>();
  for (const finding of findings) {
    const list = byFile.get(finding.file);
    if (list) list.push(finding);
    else byFile.set(finding.file, [finding]);
  }

  const order: string[] = ["### Work order", ""];
  for (const [file, list] of byFile) {
    order.push(
      `**\`${file}\`** — ${list.length} finding${list.length === 1 ? "" : "s"}`,
    );
    for (const finding of list) {
      order.push(
        `- \`${loc(finding)}\` ${finding.ruleId} (${finding.severity}) — ${finding.message}`,
      );
    }
    order.push("");
  }
  parts.push(order.join("\n").trimEnd());

  // The tail is shared, so it is stated once for the whole plan rather than
  // repeated under every finding.
  const [first] = findings;
  if (first) {
    parts.push(CONSTRAINTS);
    parts.push(doneWhen(first, project));
  }

  for (const finding of findings) {
    parts.push("---");
    parts.push(renderFindingBody(finding, project, false));
  }

  return `${parts.join("\n\n")}\n`;
}
