import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { scanCommand } from "../../../src/cli/commands/scan.js";
import type { ScanResult } from "../../../src/engine.js";
import { dbPath } from "../../../src/storage/db.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";
import { git, initRepo } from "../../helpers/git.js";

describe("scan --staged / --diff", () => {
  let project: TempProject | undefined;
  const logs: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });

  afterEach(() => {
    process.exitCode = undefined;
    logs.length = 0;
    errors.length = 0;
    project?.cleanup();
    project = undefined;
  });

  it("runs the rules only on staged files and doesn't record the scan", async () => {
    project = copyFixture("rules-app");
    initRepo(project.dir);
    const actions = path.join(project.dir, "app/actions.ts");
    fs.appendFileSync(actions, "\n");
    git(project.dir, "add", "app/actions.ts");

    await scanCommand(project.dir, { format: "json", staged: true });

    const result = JSON.parse(logs.join("\n")) as ScanResult;
    expect(result.scope).toEqual({
      partial: true,
      label: "git staged files",
      files: 1,
    });
    expect(result.findings.length).toBeGreaterThan(0);
    expect(new Set(result.findings.map((f) => f.filePath))).toEqual(
      new Set([actions]),
    );
    expect(result.scanId).toBeNull();
    expect(fs.existsSync(dbPath(project.dir))).toBe(false);
  });

  it("with nothing staged, says so and skips the scan", async () => {
    project = copyFixture("rules-app");
    initRepo(project.dir);

    await scanCommand(project.dir, { staged: true });

    expect(logs.join("\n")).toMatch(/No git staged files to scan/);
    expect(process.exitCode).toBeUndefined();
  });

  it("outside git exits 1 with the git error", async () => {
    project = copyFixture("rules-app");

    await scanCommand(project.dir, { format: "json", diff: true });

    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toMatch(/not inside a git repository/);
  });

  it("refuses --staged together with --diff", async () => {
    project = copyFixture("rules-app");
    await scanCommand(project.dir, { staged: true, diff: true });
    expect(process.exitCode).toBe(2);
  });
});
