import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { scanCommand } from "../../../src/cli/commands/scan.js";
import { dbPath } from "../../../src/storage/db.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

describe("scan command", () => {
  let project: TempProject | undefined;
  const logs: string[] = [];
  const logSpy = vi
    .spyOn(console, "log")
    .mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
  const errorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  afterEach(() => {
    process.exitCode = undefined;
    logs.length = 0;
    logSpy.mockClear();
    errorSpy.mockClear();
    project?.cleanup();
    project = undefined;
  });

  it("exits 0 without a gate flag, 1 with --fail-on-violation, and records the scan", async () => {
    project = copyFixture("rules-app");

    await scanCommand(project.dir, { format: "json" });
    expect(process.exitCode).toBeUndefined();
    expect(fs.existsSync(dbPath(project.dir))).toBe(true);

    await scanCommand(project.dir, {
      format: "json",
      failOnViolation: true,
      store: false,
    });
    expect(process.exitCode).toBe(1);
  });

  it("--strict fails a project that was never init-ed even with no findings gate", async () => {
    project = copyFixture("rules-app");
    await scanCommand(project.dir, {
      format: "json",
      strict: true,
      store: false,
    });
    expect(process.exitCode).toBe(1);
  });

  it("writes the report with --output and prints a one-line confirmation", async () => {
    project = copyFixture("rules-app");
    const output = path.join(project.dir, "reports", "bg.sarif");

    await scanCommand(project.dir, { format: "sarif", output, store: false });

    expect(fs.existsSync(output)).toBe(true);
    expect(
      (JSON.parse(fs.readFileSync(output, "utf8")) as { version: string })
        .version,
    ).toBe("2.1.0");
    expect(logs.join("\n")).toMatch(
      /sarif report → .*bg\.sarif {2}\(10 finding\(s\)/,
    );
  });

  it("rejects unknown formats and rules with exit 2", async () => {
    project = copyFixture("rules-app");

    await scanCommand(project.dir, { format: "xml", store: false });
    expect(process.exitCode).toBe(2);
    process.exitCode = undefined;

    await scanCommand(project.dir, { rule: "BG-999", store: false });
    expect(process.exitCode).toBe(2);
  });
});
