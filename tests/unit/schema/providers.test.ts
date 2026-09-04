import { afterEach, describe, expect, it } from "vitest";

import { NotImplementedError } from "../../../src/schema/errors.js";
import {
  selectableProviders,
  zeroSchemaProvider,
} from "../../../src/schema/providers/index.js";
import { openapiProvider } from "../../../src/schema/providers/openapi.js";
import { prismaProvider } from "../../../src/schema/providers/prisma.js";
import { supabaseProvider } from "../../../src/schema/providers/supabase.js";
import { zodProvider } from "../../../src/schema/providers/zod.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

describe("schema providers", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("offers prisma, supabase, openapi, zod in that order; zero-schema is not selectable", () => {
    expect(selectableProviders.map((provider) => provider.id)).toEqual([
      "prisma",
      "supabase",
      "openapi",
      "zod",
    ]);
  });

  describe("zero-schema", () => {
    it("always detects and extracts nothing", async () => {
      await expect(zeroSchemaProvider.detect("/nowhere")).resolves.toBe(true);
      await expect(
        zeroSchemaProvider.configFields("/nowhere"),
      ).resolves.toEqual([]);
      await expect(zeroSchemaProvider.extract("/nowhere", {})).resolves.toEqual(
        [],
      );
    });
  });

  describe("prisma", () => {
    it("detects prisma/schema.prisma and prefills that path", async () => {
      project = makeTempProject({ "prisma/schema.prisma": "model User {}\n" });

      await expect(prismaProvider.detect(project.dir)).resolves.toBe(true);
      await expect(prismaProvider.configFields(project.dir)).resolves.toEqual([
        expect.objectContaining({
          key: "schemaPath",
          defaultValue: "prisma/schema.prisma",
        }),
      ]);
    });

    it("detects a root-level schema.prisma and prefills that instead", async () => {
      project = makeTempProject({ "schema.prisma": "model User {}\n" });

      await expect(prismaProvider.detect(project.dir)).resolves.toBe(true);
      const [field] = await prismaProvider.configFields(project.dir);
      expect(field?.defaultValue).toBe("schema.prisma");
    });

    it("does not detect an empty project but still suggests the default path", async () => {
      project = makeTempProject();

      await expect(prismaProvider.detect(project.dir)).resolves.toBe(false);
      const [field] = await prismaProvider.configFields(project.dir);
      expect(field?.defaultValue).toBe("prisma/schema.prisma");
    });

    it("extract() is not implemented yet", async () => {
      await expect(
        prismaProvider.extract("/nowhere", {}),
      ).rejects.toBeInstanceOf(NotImplementedError);
    });
  });

  describe("supabase", () => {
    it("detects a generated types file in a conventional location", async () => {
      project = makeTempProject({
        "src/types/database.types.ts": "export type Database = {};\n",
      });

      await expect(supabaseProvider.detect(project.dir)).resolves.toBe(true);
      const [field] = await supabaseProvider.configFields(project.dir);
      expect(field?.defaultValue).toBe("src/types/database.types.ts");
    });

    it("does not detect when only the dependency is present", async () => {
      project = makeTempProject({
        "package.json": JSON.stringify({
          dependencies: { "@supabase/supabase-js": "^2.0.0" },
        }),
      });

      await expect(supabaseProvider.detect(project.dir)).resolves.toBe(false);
      expect(supabaseProvider.dependencyPackages).toContain(
        "@supabase/supabase-js",
      );
    });
  });

  describe("openapi", () => {
    it("detects a committed local spec", async () => {
      project = makeTempProject({ "swagger.json": "{}\n" });

      await expect(openapiProvider.detect(project.dir)).resolves.toBe(true);
      const [field] = await openapiProvider.configFields(project.dir);
      expect(field?.defaultValue).toBe("swagger.json");
    });

    it("has no default when nothing is committed (spec is usually a URL)", async () => {
      project = makeTempProject();

      await expect(openapiProvider.detect(project.dir)).resolves.toBe(false);
      const [field] = await openapiProvider.configFields(project.dir);
      expect(field?.defaultValue).toBe("");
    });
  });

  describe("zod", () => {
    it("never auto-detects, only offers a glob", async () => {
      project = makeTempProject({
        "package.json": JSON.stringify({ dependencies: { zod: "^4.0.0" } }),
      });

      await expect(zodProvider.detect(project.dir)).resolves.toBe(false);
      await expect(zodProvider.configFields(project.dir)).resolves.toEqual([
        expect.objectContaining({ key: "glob" }),
      ]);
    });
  });
});
