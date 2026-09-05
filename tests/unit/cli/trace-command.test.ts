import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTarget, traceCommand } from "../../../src/cli/commands/trace.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

describe("trace command", () => {
  let project: TempProject | undefined;
  const logs: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);

  afterEach(() => {
    process.exitCode = undefined;
    logs.length = 0;
    project?.cleanup();
    project = undefined;
  });

  it("parses file, file:line and file:line:col", () => {
    expect(parseTarget("app/page.tsx")).toEqual({
      file: "app/page.tsx",
      line: null,
    });
    expect(parseTarget("app/page.tsx:16")).toEqual({
      file: "app/page.tsx",
      line: 16,
    });
    expect(parseTarget("app/page.tsx:16:7")).toEqual({
      file: "app/page.tsx",
      line: 16,
    });
  });

  it("prints the finding at a line with its path, origin first", async () => {
    project = copyFixture("rules-app");

    await traceCommand("app/page.tsx:16", project.dir);

    const out = logs.join("\n");
    expect(out).toMatch(/app\/page\.tsx:16:\d+ {2}BG-001 {2}error {2}new/);
    expect(out).toContain("Path, origin → sink:");
    expect(out).toContain("↳ sink");
  });

  it("lists the file's findings when the line has none, and exits 1 for a missing file", async () => {
    project = copyFixture("rules-app");

    await traceCommand("app/page.tsx:1", project.dir, { format: "pretty" });
    expect(logs.join("\n")).toMatch(/No finding at app\/page\.tsx:1/);
    expect(logs.join("\n")).toMatch(/app\/page\.tsx:16:\d+ {2}BG-001/);
    expect(process.exitCode).toBeUndefined();

    logs.length = 0;
    await traceCommand("app/missing.tsx:3", project.dir);
    expect(process.exitCode).toBe(1);
  });

  it("--format json returns the findings with status and reversed path", async () => {
    project = copyFixture("rules-app");

    await traceCommand("app/page.tsx", project.dir, { format: "json" });

    const parsed = JSON.parse(logs.join("\n")) as {
      file: string;
      findings: { ruleId: string; status: string; path: string[] }[];
    };
    expect(parsed.file).toBe("app/page.tsx");
    expect(parsed.findings.some((f) => f.status === "suppressed")).toBe(true);
    expect(parsed.findings.some((f) => f.ruleId === "BG-001")).toBe(true);
  });
});
