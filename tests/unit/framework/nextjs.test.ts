import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { nextjsAdapter } from "../../../src/framework/nextjs.js";
import {
  makeTempProject,
  NEXT_APP_FILES,
  type TempProject,
} from "../../helpers/fixture.js";

describe("nextjsAdapter", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("detects a plain app/ layout and resolves its source root", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    await expect(nextjsAdapter.detect(project.dir)).resolves.toBe(true);
    expect(nextjsAdapter.findSourceRoot(project.dir)).toBe(
      path.join(project.dir, "app"),
    );
  });

  it("detects a src/app layout and resolves src/app, not src", async () => {
    project = makeTempProject({
      "package.json": NEXT_APP_FILES["package.json"] ?? "",
      "next.config.ts": "export default {};\n",
      "src/app/page.tsx": "export default function Page() { return null; }\n",
    });

    await expect(nextjsAdapter.detect(project.dir)).resolves.toBe(true);
    expect(nextjsAdapter.findSourceRoot(project.dir)).toBe(
      path.join(project.dir, "src", "app"),
    );
  });

  it("rejects a project without next in package.json", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }),
    });

    await expect(nextjsAdapter.detect(project.dir)).resolves.toBe(false);
  });

  it("rejects a Pages Router project (no app/ directory)", async () => {
    project = makeTempProject({
      "package.json": NEXT_APP_FILES["package.json"] ?? "",
      "next.config.mjs": "export default {};\n",
      "pages/index.tsx": "export default function Home() { return null; }\n",
    });

    await expect(nextjsAdapter.detect(project.dir)).resolves.toBe(false);
  });

  it("rejects a project with no next.config.*", async () => {
    project = makeTempProject({
      "package.json": NEXT_APP_FILES["package.json"] ?? "",
      "app/page.tsx": "export default function Page() { return null; }\n",
    });

    await expect(nextjsAdapter.detect(project.dir)).resolves.toBe(false);
  });
});
