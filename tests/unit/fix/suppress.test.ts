import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { runScan } from "../../../src/engine.js";
import {
  applySuppressionEdits,
  commentFor,
  planSuppressions,
} from "../../../src/fix/suppress.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

describe("suppression codemod", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("picks the comment form the surrounding syntax allows", () => {
    const d = "boundary-guard-disable-next-line BG-001";
    expect(commentFor(d, ["<main>", "  <Card a={x} />"], 2)).toBe(
      `{/* ${d} */}`,
    );
    expect(commentFor(d, ["<main>", "  {user.hash}"], 2)).toBe(`{/* ${d} */}`);
    expect(commentFor(d, ["  } else {", "    return <Card a={x} />;"], 2)).toBe(
      `// ${d}`,
    );
    expect(commentFor(d, ["<Card", "  hash={user.hash}"], 2)).toBe(
      `/* ${d} */`,
    );
    expect(
      commentFor(d, ["export async function POST(req: Request) {"], 1),
    ).toBe(`// ${d}`);
  });

  it("silences every new BG-001 finding in the fixture and leaves the rest", async () => {
    project = copyFixture("rules-app");
    const before = await runScan({ rootDir: project.dir, store: false });
    const bg001 = before.findings.filter((f) => f.ruleId === "BG-001");
    expect(bg001.length).toBeGreaterThan(0);

    const edits = planSuppressions(bg001, 'legacy "card" props');
    expect(
      edits.every((edit) =>
        edit.text.includes("reason=\"legacy 'card' props\""),
      ),
    ).toBe(true);
    const page = path.join(project.dir, "app/page.tsx");
    const jsxEdit = edits.find(
      (edit) => edit.filePath === page && edit.line === 16,
    );
    expect(jsxEdit?.text).toBe(
      "      {/* boundary-guard-disable-next-line BG-001 reason=\"legacy 'card' props\" */}",
    );

    const { files, inserted } = await applySuppressionEdits(edits);
    expect(files).toBe(1);
    expect(inserted).toBe(edits.length);

    const after = await runScan({ rootDir: project.dir, store: false });
    expect(after.findings.filter((f) => f.ruleId === "BG-001")).toEqual([]);
    expect(after.suppressed.length).toBe(
      before.suppressed.length + bg001.length,
    );
    expect(after.findings.filter((f) => f.ruleId !== "BG-001")).toHaveLength(
      before.findings.filter((f) => f.ruleId !== "BG-001").length,
    );
    expect(fs.readFileSync(page, "utf8")).toContain(
      "boundary-guard-disable-next-line BG-001",
    );
  });
});
