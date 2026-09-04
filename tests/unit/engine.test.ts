import path from "path";

import { afterEach, describe, expect, it } from "vitest";

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
});
