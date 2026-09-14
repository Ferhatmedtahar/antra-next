import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { writeBaseline } from "../../../src/baseline/baseline.js";
import { ensureGitignore } from "../../../src/config/gitignore.js";
import { writeConfig, writeSnapshot } from "../../../src/config/write.js";
import { runDoctor } from "../../../src/doctor/doctor.js";
import {
  copyFixture,
  makeTempProject,
  type TempProject,
} from "../../helpers/fixture.js";

const status = (report: Awaited<ReturnType<typeof runDoctor>>, id: string) =>
  report.checks.find((check) => check.id === id)?.status;

describe("runDoctor", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("a never-init-ed Next.js app is healthy with warnings, not failures", async () => {
    project = copyFixture("rules-app");

    const report = await runDoctor(project.dir);

    expect(status(report, "framework")).toBe("ok");
    expect(status(report, "config")).toBe("warn");
    expect(status(report, "baseline")).toBe("warn");
    expect(status(report, "gitignore")).toBe("warn");
    expect(status(report, "database")).toBe("ok");
    expect(status(report, "parser")).toBe("ok");
    expect(report.checks.map((check) => check.id)).not.toContain("snapshot");
    expect(report.fail).toBe(0);
    expect(report.healthy).toBe(true);
  });

  it("flags a missing provider file, a missing snapshot, and every rule off", async () => {
    project = copyFixture("rules-app");
    await writeConfig(
      project.dir,
      {
        version: 1,
        frameworkAdapter: "nextjs-app-router",
        providers: [{ id: "supabase", typesPath: "types/nope.ts" }],
        keywords: { include: ["token"] },
        sensitiveFields: { include: [], exclude: [] },
        sanitizers: [],
        rules: {
          "BG-001": false,
          "BG-002": false,
          "BG-003": false,
          "BG-004": false,
        },
      },
      { overwrite: false },
    );

    const report = await runDoctor(project.dir);

    expect(status(report, "providers")).toBe("fail");
    expect(status(report, "snapshot")).toBe("fail");
    expect(status(report, "rules")).toBe("fail");
    expect(report.healthy).toBe(false);
    expect(
      report.checks.find((check) => check.id === "providers")?.detail,
    ).toMatch(/types\/nope\.ts not found/);
  });

  it("a fully set-up project passes every check, and a stale snapshot warns", async () => {
    project = copyFixture("rules-app");
    fs.mkdirSync(path.join(project.dir, "types"));
    const types = path.join(project.dir, "types/database.types.ts");
    fs.writeFileSync(types, "export type Database = {};\n");
    await writeConfig(
      project.dir,
      {
        version: 1,
        frameworkAdapter: "nextjs-app-router",
        providers: [{ id: "supabase", typesPath: "types/database.types.ts" }],
        keywords: { include: ["token"] },
        sensitiveFields: { include: [], exclude: [] },
        sanitizers: ["zod"],
        rules: {},
      },
      { overwrite: false },
    );
    await writeSnapshot(project.dir, {
      generatedAt: new Date(Date.now() + 60_000).toISOString(),
      sources: [
        { field: "access_token", origin: "supabase:public.s.access_token" },
      ],
    });
    await writeBaseline(project.dir, ["abc"]);
    await ensureGitignore(project.dir);

    const fresh = await runDoctor(project.dir);
    expect(fresh.fail).toBe(0);
    expect(fresh.warn).toBe(0);
    expect(status(fresh, "sensitivity")).toBe("ok");

    await writeSnapshot(project.dir, {
      generatedAt: "2020-01-01T00:00:00.000Z",
      sources: [{ field: "id", origin: "supabase:public.s.id" }],
    });
    const stale = await runDoctor(project.dir);
    expect(status(stale, "snapshot")).toBe("warn");
    expect(status(stale, "sensitivity")).toBe("warn");
    expect(stale.healthy).toBe(true);
  });

  it("a non-Next.js directory fails the framework check", async () => {
    project = makeTempProject({ "package.json": "{}", "index.ts": "" });
    const report = await runDoctor(project.dir);
    expect(status(report, "framework")).toBe("fail");
    expect(report.healthy).toBe(false);
  });

  it("warns about a legacy broad keyword left in the config", async () => {
    project = copyFixture("rules-app");
    await writeConfig(
      project.dir,
      {
        version: 1,
        frameworkAdapter: "nextjs-app-router",
        providers: [],
        keywords: { include: ["password", "hash"] },
        sensitiveFields: { include: [], exclude: [] },
        sanitizers: ["zod"],
        rules: {},
      },
      { overwrite: false },
    );

    const report = await runDoctor(project.dir);

    expect(status(report, "keywords")).toBe("warn");
    expect(
      report.checks.find((check) => check.id === "keywords")?.detail,
    ).toContain("hash");
  });
});
