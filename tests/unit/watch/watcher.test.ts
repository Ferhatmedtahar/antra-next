import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import {
  isProjectSettingsPath,
  isWatchedPath,
  startWatcher,
} from "../../../src/watch/watcher.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

describe("watcher", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("watches source files and the tool's own settings, nothing else", () => {
    expect(isWatchedPath("app/page.tsx")).toBe(true);
    expect(isWatchedPath("lib/db.js")).toBe(true);
    expect(isWatchedPath("antra.config.json")).toBe(true);
    expect(isWatchedPath(".antra/contract-snapshot.json")).toBe(true);
    expect(isWatchedPath(".antra/baseline.json")).toBe(true);
    expect(isWatchedPath(".antra/antra-findings.sqlite")).toBe(false);
    expect(isWatchedPath("node_modules/next/index.js")).toBe(false);
    expect(isWatchedPath(".next/types/app.ts")).toBe(false);
    expect(isWatchedPath("app/types.d.ts")).toBe(false);
    expect(isWatchedPath("README.md")).toBe(false);
    expect(isProjectSettingsPath("app/page.tsx")).toBe(false);
    expect(isProjectSettingsPath("antra.config.json")).toBe(true);
  });

  it("batches a burst of saves into one debounced callback and follows new directories", async () => {
    project = makeTempProject({
      "app/page.tsx": "",
      "node_modules/pkg/index.js": "",
      ".next/types/app.ts": "",
    });
    const batches: string[][] = [];
    const watcher = startWatcher(project.dir, (paths) => batches.push(paths), {
      debounceMs: 150,
    });
    const waitForBatch = async (count: number) => {
      const deadline = Date.now() + 3000;
      while (batches.length < count && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };
    try {
      // root, app — never node_modules or .next
      expect(watcher.size).toBe(2);
      await new Promise((resolve) => setTimeout(resolve, 100));
      fs.writeFileSync(path.join(project.dir, "app/page.tsx"), "// a\n");
      fs.writeFileSync(path.join(project.dir, "app/new.tsx"), "// b\n");
      fs.writeFileSync(path.join(project.dir, "notes.md"), "ignored\n");
      fs.writeFileSync(
        path.join(project.dir, "node_modules/pkg/index.js"),
        "// ignored\n",
      );
      await waitForBatch(1);

      fs.mkdirSync(path.join(project.dir, "app/(auth)"));
      await new Promise((resolve) => setTimeout(resolve, 200));
      fs.writeFileSync(path.join(project.dir, "app/(auth)/layout.tsx"), "");
      await waitForBatch(2);
    } finally {
      watcher.close();
    }
    const relative = (batch: string[] | undefined) =>
      batch?.map((file) => path.relative(project?.dir ?? "", file));
    expect(batches).toHaveLength(2);
    expect(relative(batches[0])).toEqual(["app/new.tsx", "app/page.tsx"]);
    expect(relative(batches[1])).toEqual(["app/(auth)/layout.tsx"]);
  });
});
