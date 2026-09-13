import { afterEach, describe, expect, it } from "vitest";

import { classifyFile } from "../../../src/ast/boundary-classifier.js";
import { collectEdges } from "../../../src/ast/boundary-graph.js";
import { loadProject } from "../../../src/ast/project.js";
import {
  copyFixture,
  makeTempProject,
  NEXT_APP_FILES,
  type TempProject,
} from "../../helpers/fixture.js";

function edgesOf(rootDir: string) {
  const { sourceFiles } = loadProject(rootDir);
  const classifications = new Map(
    sourceFiles.map((file) => {
      const entry = classifyFile(file);
      return [entry.filePath, entry];
    }),
  );
  return collectEdges(sourceFiles, classifications).map((edge) => ({
    ...edge,
    from: edge.from.slice(rootDir.length + 1),
    to: edge.to.slice(rootDir.length + 1),
  }));
}

describe("collectEdges", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("links a server page to every component it renders, once per target file", () => {
    project = copyFixture("rules-app");
    const edges = edgesOf(project.dir);

    const fromPage = edges.filter((edge) => edge.from === "app/page.tsx");
    expect(fromPage.map((edge) => [edge.to, edge.kind, edge.names])).toEqual([
      ["components/ClientCard.tsx", "renders", ["ClientCard"]],
      ["components/ServerBadge.tsx", "renders", ["ServerBadge"]],
    ]);
    expect(fromPage[0]?.count).toBeGreaterThan(5);
  });

  it("links a client file to the server actions it imports, by name", () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "app/actions.ts":
        '"use server";\nexport async function save() {}\nexport async function remove() {}\n',
      "lib/mixed.ts":
        'export async function update() { "use server"; }\nexport const helper = 1;\n',
      "components/Form.tsx":
        '"use client";\nimport { save } from "../app/actions";\nimport { helper, update } from "../lib/mixed";\nexport const Form = () => { void save; void update; void helper; return null; };\n',
    });
    const edges = edgesOf(project.dir);

    expect(edges).toEqual([
      {
        from: "components/Form.tsx",
        to: "app/actions.ts",
        kind: "calls-action",
        names: ["save"],
        count: 1,
      },
      {
        from: "components/Form.tsx",
        to: "lib/mixed.ts",
        kind: "calls-action",
        names: ["update"],
        count: 1,
      },
    ]);
  });
});
