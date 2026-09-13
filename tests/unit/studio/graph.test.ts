import { afterEach, describe, expect, it } from "vitest";

import { runScan } from "../../../src/engine.js";
import { createStudioApp } from "../../../src/studio/server.js";
import type { GraphResponse } from "../../../src/studio/types.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

describe("GET /api/scans/:id/graph", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("returns the render edges with crossings and findings attached", async () => {
    project = copyFixture("rules-app");
    const scan = await runScan({ rootDir: project.dir });
    const app = createStudioApp(project.dir);

    const response = await app.request(`/api/scans/${scan.scanId}/graph`);
    expect(response.status).toBe(200);
    const graph = (await response.json()) as GraphResponse;

    const toClient = graph.edges.find(
      (edge) =>
        edge.from === "app/page.tsx" && edge.to === "components/ClientCard.tsx",
    );
    expect(toClient).toMatchObject({
      kind: "renders",
      crossing: true,
      names: ["ClientCard"],
    });
    expect(toClient?.count).toBeGreaterThan(5);
    expect(toClient?.findings).toBeGreaterThan(0);
    expect(toClient?.newFindings).toBe(toClient?.findings);

    const toServer = graph.edges.find(
      (edge) => edge.to === "components/ServerBadge.tsx",
    );
    expect(toServer?.crossing).toBe(false);
    expect(toServer?.findings).toBe(0);

    const page = graph.nodes.find((node) => node.id === "app/page.tsx");
    expect(page?.kind).toBe("server");
    expect(page?.newFindings).toBeGreaterThan(0);
    expect(
      graph.nodes.find((node) => node.id === "components/ClientCard.tsx")?.kind,
    ).toBe("client");
    // Files with neither an edge nor a finding stay out of the picture.
    expect(graph.nodes.some((node) => node.id === "lib/schema.ts")).toBe(false);
  });

  it("404s for an unknown scan", async () => {
    project = copyFixture("rules-app");
    await runScan({ rootDir: project.dir });
    const response = await createStudioApp(project.dir).request(
      "/api/scans/999/graph",
    );
    expect(response.status).toBe(404);
  });
});
