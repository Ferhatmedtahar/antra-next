import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { writeConfig, writeSnapshot } from "../../src/config/write.js";
import { runScan } from "../../src/engine.js";
import { FrameworkNotDetectedError } from "../../src/framework/detect.js";
import {
  makeTempProject,
  NEXT_APP_FILES,
  type TempProject,
} from "../helpers/fixture.js";

describe("runScan", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("rejects a non-Next.js directory", async () => {
    project = makeTempProject({ "package.json": "{}" });

    await expect(runScan({ rootDir: project.dir })).rejects.toBeInstanceOf(
      FrameworkNotDetectedError,
    );
  });

  it("loads the whole tree (minus build output) and classifies every file", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "app/actions.ts": '"use server";\nexport async function save() {}\n',
      "app/api/users/route.ts":
        "export async function POST(request: Request) { return request.json(); }\n",
      "components/Card.tsx": '"use client";\nexport const Card = () => null;\n',
      "node_modules/pkg/index.ts": '"use client";\nexport const Nope = 1;\n',
      ".next/types/app.ts": "export const generated = 1;\n",
    });

    const result = await runScan({ rootDir: project.dir });

    expect(result.frameworkAdapter).toBe("nextjs-app-router");
    expect(result.sourceRoot).toBe(path.join(project.dir, "app"));
    expect(result.configPresent).toBe(false);
    expect(result.taintSources).toEqual([]);

    const byFile = new Map(
      result.classifications.map((c) => [
        path.relative(project?.dir ?? "", c.filePath),
        c,
      ]),
    );
    expect([...byFile.keys()].sort()).toEqual([
      "app/actions.ts",
      "app/api/users/route.ts",
      "app/page.tsx",
      "components/Card.tsx",
    ]);
    expect(byFile.get("components/Card.tsx")?.boundary).toBe("client");
    expect(byFile.get("app/page.tsx")?.boundary).toBe("server");
    expect(byFile.get("app/actions.ts")?.serverActions).toEqual([
      { name: "save", line: 2 },
    ]);
    expect(byFile.get("app/api/users/route.ts")?.routeMethods).toEqual([
      "POST",
    ]);
  });

  it("reports phases in pipeline order for progress spinners", async () => {
    project = makeTempProject(NEXT_APP_FILES);
    const phases: string[] = [];

    await runScan({
      rootDir: project.dir,
      store: false,
      onPhase: (phase, detail) =>
        phases.push(detail ? `${phase}:${detail}` : phase),
    });

    expect(phases).toEqual([
      "detect",
      "config",
      "project",
      "classify:1 files",
      "rules:BG-001, BG-002, BG-003, BG-004",
    ]);
  });

  it("loads the snapshot and keeps only keyword-sensitive fields as taint sources", async () => {
    project = makeTempProject(NEXT_APP_FILES);
    await writeConfig(
      project.dir,
      {
        version: 1,
        frameworkAdapter: "nextjs-app-router",
        providers: [],
        keywords: { include: ["token"] },
        sensitiveFields: {
          include: ["supabase:public.tutors.iban"],
          exclude: ["public_token"],
        },
        sanitizers: [],
        rules: {},
      },
      { overwrite: false },
    );
    await writeSnapshot(project.dir, {
      generatedAt: "2026-09-04T00:00:00.000Z",
      sources: [
        { field: "id", origin: "supabase:public.users.id" },
        {
          field: "access_token",
          origin: "supabase:public.sessions.access_token",
        },
        {
          field: "public_token",
          origin: "supabase:public.shares.public_token",
        },
        { field: "iban", origin: "supabase:public.tutors.iban" },
      ],
    });

    const result = await runScan({ rootDir: project.dir });

    expect(result.configPresent).toBe(true);
    expect(result.schemaFields).toHaveLength(4);
    expect(result.taintSources.map((s) => s.field)).toEqual([
      "access_token",
      "iban",
    ]);
  });
});
