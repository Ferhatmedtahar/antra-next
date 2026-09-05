import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  DEFAULT_KEYWORDS,
  DEFAULT_SANITIZERS,
} from "../../../src/config/defaults.js";
import { writeConfig, writeSnapshot } from "../../../src/config/write.js";
import { runScan, type ScanResult } from "../../../src/engine.js";
import {
  getReporter,
  isReportFormat,
  REPORT_FORMATS,
} from "../../../src/reporters/index.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

const ESC = "[";

let project: TempProject;
let result: ScanResult;

beforeAll(async () => {
  project = copyFixture("rules-app");
  await writeConfig(
    project.dir,
    {
      version: 1,
      frameworkAdapter: "nextjs-app-router",
      providers: [],
      keywords: { include: [...DEFAULT_KEYWORDS] },
      sensitiveFields: { include: [], exclude: [] },
      sanitizers: [...DEFAULT_SANITIZERS],
      rules: {},
    },
    { overwrite: false },
  );
  await writeSnapshot(project.dir, {
    generatedAt: "2026-09-05T00:00:00.000Z",
    sources: [{ field: "password_hash", origin: "prisma:User.password_hash" }],
  });
  result = await runScan({ rootDir: project.dir, store: false });
});

afterAll(() => {
  project.cleanup();
});

const ctx = () => ({ rootDir: project.dir, color: false, verbose: false });

describe("reporter registry", () => {
  it("knows pretty, json and sarif", () => {
    expect(REPORT_FORMATS).toEqual(["pretty", "json", "sarif"]);
    expect(isReportFormat("sarif")).toBe(true);
    expect(isReportFormat("xml")).toBe(false);
  });
});

describe("terminal reporter", () => {
  it("prints a summary, then each finding with a code frame and its trace", () => {
    const text = getReporter("pretty").render(result, ctx());

    expect(text).toContain(
      "taint sources:     1 sensitive of 1 schema field(s)",
    );
    expect(text).toContain("files scanned:     8");
    expect(text).toContain(
      "✖ 10 finding(s)  [BG-001 ×5, BG-002 ×2, BG-003 ×2, BG-004 ×1]",
    );
    expect(text).toContain("1 suppressed by inline comment");
    expect(text).toContain("\napp/page.tsx\n");
    expect(text).toContain(
      '16:19  error  BG-001  Schema field "password_hash"',
    );
    expect(text).toMatch(
      /> 16 \| {7}<ClientCard hash=\{user\.password_hash\} \/>/,
    );
    expect(text).toMatch(/\| {19}\^{25}\n/);
    expect(text).toContain("↳ user ← await db.user.findUnique");
    expect(text).not.toContain(ESC);
  });

  it("colours only when asked", () => {
    const plain = getReporter("pretty").render(result, ctx());
    const coloured = getReporter("pretty").render(result, {
      ...ctx(),
      color: true,
    });
    expect(plain).not.toContain(ESC);
    // Under a real terminal this carries ANSI codes; under CI without colour
    // support chalk auto-detects level 0 and the two are identical.
    expect(coloured.replace(/\[[0-9;]*m/g, "")).toBe(plain);
  });
});

describe("json reporter", () => {
  it("round-trips the whole result", () => {
    const parsed = JSON.parse(
      getReporter("json").render(result, ctx()),
    ) as ScanResult;
    expect(parsed.findings).toHaveLength(10);
    expect(parsed.rulesRun).toEqual(["BG-001", "BG-002", "BG-003", "BG-004"]);
  });
});

describe("sarif reporter", () => {
  it("emits SARIF 2.1.0 with rules, relative URIs, fingerprints and suppressions", () => {
    const log = JSON.parse(getReporter("sarif").render(result, ctx())) as {
      version: string;
      runs: {
        tool: {
          driver: {
            name: string;
            rules: { id: string; defaultConfiguration: { level: string } }[];
          };
        };
        originalUriBaseIds: Record<string, { uri: string }>;
        results: {
          ruleId: string;
          level: string;
          locations: {
            physicalLocation: {
              artifactLocation: { uri: string };
              region: { startLine: number; startColumn: number };
            };
          }[];
          partialFingerprints: Record<string, string>;
          suppressions?: { kind: string; justification?: string }[];
          baselineState?: string;
        }[];
      }[];
    };

    expect(log.version).toBe("2.1.0");
    const run = log.runs[0];
    expect(run?.tool.driver.name).toBe("boundary-guard");
    expect(
      run?.tool.driver.rules.map((r) => [r.id, r.defaultConfiguration.level]),
    ).toEqual([
      ["BG-001", "error"],
      ["BG-002", "error"],
      ["BG-003", "warning"],
      ["BG-004", "error"],
    ]);
    expect(run?.originalUriBaseIds["%SRCROOT%"]?.uri).toMatch(
      /^file:\/\/.*\/$/,
    );

    expect(run?.results).toHaveLength(11); // 10 active + 1 suppressed
    const first = run?.results.find(
      (r) => r.locations[0]?.physicalLocation.region.startLine === 16,
    );
    expect(first).toMatchObject({
      ruleId: "BG-001",
      level: "error",
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: "app/page.tsx" },
            region: { startLine: 16, startColumn: 19 },
          },
        },
      ],
    });
    expect(first?.partialFingerprints["boundaryGuard/v1"]).toHaveLength(16);
    expect(first?.baselineState).toBeUndefined();

    const suppressed = run?.results.find((r) => r.suppressions);
    expect(suppressed?.suppressions).toEqual([
      { kind: "inSource", justification: "public share token" },
    ]);
  });
});
