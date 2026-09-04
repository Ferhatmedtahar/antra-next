import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ensureGitignore,
  GITIGNORE_ENTRIES,
  GITIGNORE_MARKER,
} from "../../../src/config/gitignore.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

describe("ensureGitignore", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("creates .gitignore with the managed block when missing", async () => {
    project = makeTempProject();

    const result = await ensureGitignore(project.dir);

    expect(result.status).toBe("created");
    const text = fs.readFileSync(path.join(project.dir, ".gitignore"), "utf8");
    expect(text.startsWith(GITIGNORE_MARKER)).toBe(true);
    for (const entry of GITIGNORE_ENTRIES)
      expect(text).toContain(`\n${entry}\n`);
    expect(text).not.toContain("contract-snapshot.json");
  });

  it("appends to an existing .gitignore without touching its content", async () => {
    project = makeTempProject({ ".gitignore": "node_modules\n.env" });

    const result = await ensureGitignore(project.dir);

    expect(result.status).toBe("appended");
    const text = fs.readFileSync(path.join(project.dir, ".gitignore"), "utf8");
    expect(text.startsWith("node_modules\n.env\n\n")).toBe(true);
    expect(text).toContain(GITIGNORE_MARKER);
  });

  it("is idempotent: a second run changes nothing, even if entries were edited", async () => {
    project = makeTempProject({
      ".gitignore": `dist\n${GITIGNORE_MARKER}\n.boundary-guard/*.sqlite\n`,
    });
    const before = fs.readFileSync(
      path.join(project.dir, ".gitignore"),
      "utf8",
    );

    const result = await ensureGitignore(project.dir);

    expect(result.status).toBe("unchanged");
    expect(fs.readFileSync(path.join(project.dir, ".gitignore"), "utf8")).toBe(
      before,
    );
  });
});
