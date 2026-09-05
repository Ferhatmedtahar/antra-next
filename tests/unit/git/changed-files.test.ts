import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { GitError, listChangedFiles } from "../../../src/git/changed-files.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";
import { git, initRepo } from "../../helpers/git.js";

describe("listChangedFiles", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("staged: only what's in the index, as absolute paths under rootDir", async () => {
    project = makeTempProject({
      "app/page.tsx": "export default () => null;\n",
      "app/other.tsx": "export default () => null;\n",
    });
    initRepo(project.dir);
    fs.writeFileSync(path.join(project.dir, "app/page.tsx"), "// changed\n");
    fs.writeFileSync(path.join(project.dir, "app/other.tsx"), "// changed\n");
    fs.writeFileSync(path.join(project.dir, "app/new.tsx"), "// new\n");
    git(project.dir, "add", "app/page.tsx", "app/new.tsx");

    const { files, base } = await listChangedFiles(project.dir, "staged");

    expect(base).toBeNull();
    expect(
      files.map((file) => path.relative(project?.dir ?? "", file)),
    ).toEqual(["app/new.tsx", "app/page.tsx"]);
  });

  it("diff: everything different from the merge-base with main, including untracked", async () => {
    project = makeTempProject({
      "app/page.tsx": "export default () => null;\n",
      "app/kept.tsx": "export default () => null;\n",
    });
    initRepo(project.dir);
    git(project.dir, "checkout", "-q", "-b", "feature");
    fs.writeFileSync(path.join(project.dir, "app/page.tsx"), "// committed\n");
    git(project.dir, "add", "-A");
    git(project.dir, "commit", "-q", "-m", "change");
    // A change on main after the branch point must not count.
    git(project.dir, "checkout", "-q", "main");
    fs.writeFileSync(path.join(project.dir, "app/main-only.tsx"), "// main\n");
    git(project.dir, "add", "-A");
    git(project.dir, "commit", "-q", "-m", "main moves on");
    git(project.dir, "checkout", "-q", "feature");
    // Uncommitted and untracked work on the branch does count.
    fs.writeFileSync(path.join(project.dir, "app/untracked.tsx"), "// new\n");
    fs.writeFileSync(path.join(project.dir, "app/kept.tsx"), "// dirty\n");

    const { files, base } = await listChangedFiles(project.dir, "diff");

    expect(base).toBe("main");
    expect(
      files.map((file) => path.relative(project?.dir ?? "", file)),
    ).toEqual(["app/kept.tsx", "app/page.tsx", "app/untracked.tsx"]);
  });

  it("diff: an explicit --base that doesn't exist is a GitError", async () => {
    project = makeTempProject({ "a.ts": "" });
    initRepo(project.dir);
    await expect(
      listChangedFiles(project.dir, "diff", "nope"),
    ).rejects.toBeInstanceOf(GitError);
  });

  it("outside a repository is a GitError", async () => {
    project = makeTempProject({ "a.ts": "" });
    await expect(
      listChangedFiles(project.dir, "staged"),
    ).rejects.toBeInstanceOf(GitError);
  });
});
