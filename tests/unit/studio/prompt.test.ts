import { describe, expect, it } from "vitest";

import {
  renderFindingPrompt,
  renderPlanPrompt,
} from "../../../src/studio/prompt.js";
import type {
  CodeFrame,
  FindingDetail,
  ProjectInfo,
  ScanSummary,
} from "../../../src/studio/types.js";

const dbFrame: CodeFrame = {
  startLine: 8,
  lines: ["  return db.user.findUnique({", "    where: { id: 1 },", "  });"],
};

const project: ProjectInfo = {
  rootDir: "/tmp/app",
  name: "app",
  configPresent: true,
  version: "0.1.0",
  latest: null,
  packageManager: "pnpm",
};

function finding(over: Partial<FindingDetail> = {}): FindingDetail {
  return {
    id: 1,
    ruleId: "BG-003",
    severity: "error",
    file: "app/page.tsx",
    line: 14,
    column: 6,
    message: "Raw database row reaches a Client Component prop.",
    snippet: "<ProfileCard user={user} />",
    // Engine order is nearest-to-sink first.
    trace: [
      {
        text: "user",
        file: "app/page.tsx",
        line: 11,
        frame: { startLine: 11, lines: ["const user = await getUser();"] },
      },
      {
        text: "db.user.findUnique",
        file: "lib/db.ts",
        line: 9,
        frame: dbFrame,
      },
    ],
    fingerprint: "a1b2c3d4",
    status: "active",
    suppressReason: null,
    frame: {
      startLine: 13,
      lines: [
        "  const user = await getUser();",
        "  return <ProfileCard user={user} />;",
      ],
    },
    ...over,
  };
}

describe("renderFindingPrompt", () => {
  it("names the rule, severity and location", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("## Security finding: BG-003 (error)");
    expect(out).toContain("`app/page.tsx:14:6`");
  });

  it("explains the rule using its authored prose", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("### Why Antra flagged this");
    expect(out).toContain("Opaque Ingress Object Pass");
    expect(out).toContain("This is NOT a TypeScript typing error");
  });

  it("lists hops origin-first, not sink-first", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out.indexOf("lib/db.ts:9")).toBeLessThan(
      out.indexOf("app/page.tsx:11"),
    );
  });

  it("renders the code frame at each hop", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("db.user.findUnique({");
    expect(out).toContain("const user = await getUser();");
    expect(out).toContain("8 |");
  });

  it("renders the sink with its location and snippet", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("sink");
    expect(out).toContain("<ProfileCard user={user} />");
  });

  it("includes the recommended fix and its example", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("### Required fix");
    expect(out).toContain("studentUser.first_name");
  });

  it("lists the remaining accepted approaches", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("### Other approaches Antra accepts");
    expect(out).toContain("Schema / DTO Sanitizer");
  });

  it("uses the detected package manager in the verification command", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("pnpm exec antra scan --fail-on error");
    expect(out).not.toContain("npx antra scan");
  });

  it("ends with the fingerprint", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).toContain("Finding fingerprint: `a1b2c3d4`");
  });

  it("omits the trace section when there is no trace", () => {
    const out = renderFindingPrompt(finding({ trace: [] }), project);
    expect(out).not.toContain("### How the data traveled");
  });

  it("renders a hop with no frame as text plus its location", () => {
    const out = renderFindingPrompt(
      finding({ trace: [{ text: "req.body", file: "app/route.ts", line: 5 }] }),
      project,
    );
    expect(out).toContain("app/route.ts:5");
    expect(out).toContain("req.body");
  });

  it("omits rule prose for a rule with no guidance entry", () => {
    const out = renderFindingPrompt(
      finding({ ruleId: "BG-999" as FindingDetail["ruleId"] }),
      project,
    );
    expect(out).not.toContain("### Why Antra flagged this");
    expect(out).toContain("### Constraints");
  });

  it("leaks no placeholder values", () => {
    const out = renderFindingPrompt(finding(), project);
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("[object Object]");
  });
});

describe("renderPlanPrompt", () => {
  const scan: ScanSummary = {
    id: 7,
    startedAt: "2026-09-14T10:00:00.000Z",
    durationMs: 1200,
    framework: "nextjs",
    rules: ["BG-001", "BG-003"],
    files: 12,
    schemaFields: 30,
    taintSources: 4,
    findings: 2,
    suppressed: 0,
    baselined: 0,
  };

  it("counts findings and histograms the rules", () => {
    const out = renderPlanPrompt({
      project,
      scan,
      findings: [finding(), finding({ id: 2, ruleId: "BG-001" })],
    });
    expect(out).toContain("## Antra remediation plan — 2 findings");
    expect(out).toContain("BG-003 ×1");
    expect(out).toContain("BG-001 ×1");
  });

  it("groups the work order by file", () => {
    const out = renderPlanPrompt({
      project,
      scan,
      findings: [finding(), finding({ id: 2, line: 30 })],
    });
    expect(out).toContain("**`app/page.tsx`** — 2 findings");
  });

  it("states the shared constraints exactly once", () => {
    const out = renderPlanPrompt({
      project,
      scan,
      findings: [finding(), finding({ id: 2 }), finding({ id: 3 })],
    });
    const occurrences = out.split("### Constraints").length - 1;
    expect(occurrences).toBe(1);
  });

  it("still carries each finding's own detail", () => {
    const out = renderPlanPrompt({
      project,
      scan,
      findings: [finding(), finding({ id: 2, file: "app/other.tsx" })],
    });
    expect(out).toContain("app/other.tsx:14:6");
    expect(out).toContain("### How the data traveled");
  });

  it("handles an empty finding list without crashing", () => {
    const out = renderPlanPrompt({ project, scan, findings: [] });
    expect(out).toContain("0 findings");
    expect(out).not.toContain("[object Object]");
    expect(out).not.toContain("undefined");
  });
});
