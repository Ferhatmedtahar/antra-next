import fs from "fs";

import { afterEach, describe, expect, it } from "vitest";

import type { ScanResult } from "../../../src/engine.js";
import { dbPath, FindingsStore } from "../../../src/storage/db.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

function sampleResult(rootDir: string): ScanResult {
  const finding = (line: number, ruleId: "BG-001" | "BG-002" = "BG-001") => ({
    ruleId,
    severity: "error" as const,
    message: `m${line}`,
    filePath: `${rootDir}/app/page.tsx`,
    line,
    column: 3,
    snippet: `s${line}`,
    trace: ["a", "b"],
    fingerprint: `fp${line}`,
  });
  return {
    startedAt: "2026-09-05T00:00:00.000Z",
    durationMs: 42,
    frameworkAdapter: "nextjs-app-router",
    sourceRoot: `${rootDir}/app`,
    configPresent: true,
    classifications: [
      {
        filePath: `${rootDir}/app/page.tsx`,
        boundary: "server",
        isServerActionModule: false,
        isRouteHandler: false,
        routeMethods: [],
        serverActions: [{ name: "save", line: 9 }],
      },
    ],
    schemaFields: [
      { field: "id", origin: "prisma:User.id" },
      { field: "password_hash", origin: "prisma:User.password_hash" },
    ],
    taintSources: [
      { field: "password_hash", origin: "prisma:User.password_hash" },
    ],
    rulesRun: ["BG-001", "BG-002"],
    findings: [finding(16)],
    suppressed: [{ ...finding(28), suppressed: { reason: "public" } }],
    baselined: [finding(11, "BG-002")],
    scanId: null,
    storeError: null,
  };
}

describe("FindingsStore", () => {
  let project: TempProject | undefined;
  let store: FindingsStore | undefined;

  afterEach(() => {
    store?.close();
    store = undefined;
    project?.cleanup();
    project = undefined;
  });

  it("creates the database under .boundary-guard and appends scans", () => {
    project = makeTempProject();
    store = FindingsStore.open(project.dir);

    const first = store.saveScan(sampleResult(project.dir), project.dir);
    const second = store.saveScan(sampleResult(project.dir), project.dir);

    expect(fs.existsSync(dbPath(project.dir))).toBe(true);
    expect([first, second]).toEqual([1, 2]);
    expect(store.listScans().map((scan) => scan.id)).toEqual([2, 1]);
    expect(store.latestScan()).toMatchObject({
      id: 2,
      framework: "nextjs-app-router",
      rules: ["BG-001", "BG-002"],
      files: 1,
      schemaFields: 2,
      taintSources: 1,
      findings: 1,
      suppressed: 1,
      baselined: 1,
      durationMs: 42,
    });
  });

  it("stores every finding with its status, relative path, trace and fingerprint", () => {
    project = makeTempProject();
    store = FindingsStore.open(project.dir);
    const scanId = store.saveScan(sampleResult(project.dir), project.dir);

    const rows = store.findingsForScan(scanId);

    expect(
      rows.map((row) => [row.line, row.status, row.suppressReason]),
    ).toEqual([
      [11, "baselined", null],
      [16, "active", null],
      [28, "suppressed", "public"],
    ]);
    expect(rows[1]).toMatchObject({
      scanId,
      ruleId: "BG-001",
      file: "app/page.tsx",
      column: 3,
      trace: ["a", "b"],
      fingerprint: "fp16",
    });
  });

  it("reopens an existing database without losing scans", () => {
    project = makeTempProject();
    store = FindingsStore.open(project.dir);
    store.saveScan(sampleResult(project.dir), project.dir);
    store.close();

    store = FindingsStore.open(project.dir);
    expect(store.listScans()).toHaveLength(1);
  });
});
