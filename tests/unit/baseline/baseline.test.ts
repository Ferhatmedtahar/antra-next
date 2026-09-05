import fs from "fs";

import { afterEach, describe, expect, it } from "vitest";

import {
  assignFingerprints,
  baselinePath,
  loadBaseline,
  splitBaselined,
  writeBaseline,
} from "../../../src/baseline/baseline.js";
import { runScan } from "../../../src/engine.js";
import type { Finding } from "../../../src/rules/types.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

const finding = (overrides: Partial<Finding>): Finding => ({
  ruleId: "BG-001",
  severity: "error",
  message: "m",
  filePath: "/root/app/page.tsx",
  line: 1,
  column: 1,
  snippet: "hash={user.password_hash}",
  trace: [],
  ...overrides,
});

describe("assignFingerprints", () => {
  it("is stable across line moves and distinct across rule, file, sink, and repeats", () => {
    const [a] = assignFingerprints([finding({ line: 10 })], "/root");
    const [b] = assignFingerprints([finding({ line: 99 })], "/root");
    const [otherRule] = assignFingerprints(
      [finding({ ruleId: "BG-004" })],
      "/root",
    );
    const [otherFile] = assignFingerprints(
      [finding({ filePath: "/root/app/x.tsx" })],
      "/root",
    );
    const [otherSink] = assignFingerprints(
      [finding({ snippet: "token={t}" })],
      "/root",
    );
    const [first, second] = assignFingerprints(
      [finding({ line: 1 }), finding({ line: 2 })],
      "/root",
    );

    expect(a?.fingerprint).toBe(b?.fingerprint);
    expect(a?.fingerprint).toHaveLength(16);
    expect(
      new Set([
        a?.fingerprint,
        otherRule?.fingerprint,
        otherFile?.fingerprint,
        otherSink?.fingerprint,
      ]).size,
    ).toBe(4);
    expect(first?.fingerprint).not.toBe(second?.fingerprint);
    expect(first?.fingerprint).toBe(a?.fingerprint);
  });
});

describe("baseline file + splitBaselined", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("round-trips, dedupes and sorts fingerprints", async () => {
    project = copyFixture("rules-app");

    const target = await writeBaseline(project.dir, ["b", "a", "b"]);

    expect(target).toBe(baselinePath(project.dir));
    expect(fs.existsSync(target)).toBe(true);
    await expect(loadBaseline(project.dir)).resolves.toMatchObject({
      fingerprints: ["a", "b"],
    });
  });

  it("returns null and keeps everything active when there is no baseline", async () => {
    project = copyFixture("rules-app");
    await expect(loadBaseline(project.dir)).resolves.toBeNull();
    const findings = assignFingerprints([finding({})], project.dir);
    expect(splitBaselined(findings, null)).toEqual({
      active: findings,
      baselined: [],
    });
  });

  it("end to end: baselined findings stop being new, ignoreBaseline brings them back", async () => {
    project = copyFixture("rules-app");
    const before = await runScan({
      rootDir: project.dir,
      ignoreBaseline: true,
      store: false,
    });
    const bg002 = before.findings.filter((f) => f.ruleId === "BG-002");
    expect(bg002).toHaveLength(2);
    await writeBaseline(
      project.dir,
      bg002.map((f) => f.fingerprint ?? ""),
    );

    const after = await runScan({ rootDir: project.dir, store: false });
    expect(after.baselined.map((f) => f.ruleId)).toEqual(["BG-002", "BG-002"]);
    expect(after.findings.some((f) => f.ruleId === "BG-002")).toBe(false);
    expect(after.findings).toHaveLength(before.findings.length - 2);

    const ignored = await runScan({
      rootDir: project.dir,
      ignoreBaseline: true,
      store: false,
    });
    expect(ignored.baselined).toEqual([]);
    expect(ignored.findings).toHaveLength(before.findings.length);
  });
});
