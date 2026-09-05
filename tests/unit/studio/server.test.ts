import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  DEFAULT_KEYWORDS,
  DEFAULT_SANITIZERS,
} from "../../../src/config/defaults.js";
import { writeConfig, writeSnapshot } from "../../../src/config/write.js";
import { runScan } from "../../../src/engine.js";
import { createStudioApp } from "../../../src/studio/server.js";
import type {
  BaselineResponse,
  ProjectInfo,
  ScanDetail,
  ScanRunResponse,
  ScanSummary,
  SourcesResponse,
  StudioConfig,
} from "../../../src/studio/types.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

let project: TempProject;
let app: ReturnType<typeof createStudioApp>;

const get = async <T>(path: string): Promise<{ status: number; body: T }> => {
  const response = await app.request(path);
  return { status: response.status, body: (await response.json()) as T };
};

beforeAll(async () => {
  project = copyFixture("rules-app");
  await writeConfig(
    project.dir,
    {
      version: 1,
      frameworkAdapter: "nextjs-app-router",
      providers: [],
      keywords: { include: [...DEFAULT_KEYWORDS] },
      sensitiveFields: { include: [], exclude: ["source_hash"] },
      sanitizers: [...DEFAULT_SANITIZERS],
      rules: {},
    },
    { overwrite: false },
  );
  await writeSnapshot(project.dir, {
    generatedAt: "2026-09-05T00:00:00.000Z",
    sources: [
      { field: "password_hash", origin: "prisma:User.password_hash" },
      { field: "email", origin: "prisma:User.email" },
      { field: "source_hash", origin: "prisma:Doc.source_hash" },
    ],
  });
  await runScan({ rootDir: project.dir });
  app = createStudioApp(project.dir);
});

afterAll(() => {
  project.cleanup();
});

describe("studio api", () => {
  it("describes the project and its latest scan", async () => {
    const { status, body } = await get<ProjectInfo>("/api/project");
    expect(status).toBe(200);
    expect(body).toMatchObject({
      configPresent: true,
      name: expect.stringContaining("rules-app"),
    });
    expect(body.latest).toMatchObject({
      id: 1,
      findings: 10,
      suppressed: 1,
      baselined: 0,
    });
  });

  it("lists scans and returns a scan with code frames and files", async () => {
    const scans = await get<ScanSummary[]>("/api/scans");
    expect(scans.body.map((s) => s.id)).toEqual([1]);

    const { body } = await get<ScanDetail>("/api/scans/1");
    expect(body.findings).toHaveLength(11);
    const first = body.findings.find(
      (f) => f.line === 16 && f.file.endsWith("page.tsx"),
    );
    expect(first?.frame).toMatchObject({ startLine: 14 });
    expect(first?.frame?.lines[2]).toContain(
      "<ClientCard hash={user.password_hash} />",
    );
    expect(
      body.files.map((f) => f.boundary).filter((b) => b === "client"),
    ).toHaveLength(1);

    expect((await get<unknown>("/api/scans/99")).status).toBe(404);
  });

  it("explains each schema field's sensitivity", async () => {
    const { body } = await get<SourcesResponse>("/api/sources");
    const byField = Object.fromEntries(body.fields.map((f) => [f.field, f]));
    expect(byField["password_hash"]).toMatchObject({
      sensitive: true,
      keywordHit: true,
      pinned: false,
      ignored: false,
    });
    expect(byField["email"]).toMatchObject({
      sensitive: false,
      keywordHit: false,
    });
    expect(byField["source_hash"]).toMatchObject({
      sensitive: false,
      keywordHit: true,
      ignored: true,
    });
  });

  it("reads and writes the config, rejecting invalid shapes", async () => {
    const before = await get<StudioConfig>("/api/config");
    expect(before.body.rules).toEqual({});

    const next: StudioConfig = {
      ...before.body,
      rules: { "BG-002": false },
      sensitiveFields: { include: ["prisma:User.email"], exclude: [] },
    };
    const saved = await app.request("/api/config", {
      method: "PUT",
      body: JSON.stringify(next),
      headers: { "Content-Type": "application/json" },
    });
    expect(saved.status).toBe(200);

    const after = await get<StudioConfig>("/api/config");
    expect(after.body.rules).toEqual({ "BG-002": false });
    const sources = await get<SourcesResponse>("/api/sources");
    expect(sources.body.fields.find((f) => f.field === "email")).toMatchObject({
      sensitive: true,
      pinned: true,
    });

    const bad = await app.request("/api/config", {
      method: "PUT",
      body: JSON.stringify({ version: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe(
      "Invalid config",
    );
  });

  it("runs a scan honouring the saved config, and records a baseline", async () => {
    const run = await app.request("/api/scan", { method: "POST" });
    const body = (await run.json()) as ScanRunResponse;
    expect(body.scanId).toBe(2);
    // BG-002 was switched off (−2) and `email` pinned (+1: `user={safe}` now
    // carries a sensitive field) in the previous test — the saved config drives the scan.
    expect(body.findings).toBe(9);

    const baseline = await app.request("/api/baseline", { method: "POST" });
    const recorded = (await baseline.json()) as BaselineResponse;
    expect(recorded.recorded).toBe(9);
    expect(recorded.file).toBe(".boundary-guard/baseline.json");

    const again = (await (
      await app.request("/api/scan", { method: "POST" })
    ).json()) as ScanRunResponse;
    expect(again).toMatchObject({ scanId: 3, findings: 0, baselined: 9 });
  });

  it("serves the SPA index for unknown paths, or a clear 503 when assets aren't built", async () => {
    const response = await app.request("/findings");
    expect([200, 503]).toContain(response.status);
    if (response.status === 200) {
      expect(await response.text()).toContain('<div id="root">');
    } else {
      expect(await response.text()).toContain("pnpm build:studio");
    }
  });
});
