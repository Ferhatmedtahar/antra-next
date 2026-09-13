import { afterEach, describe, expect, it } from "vitest";

import {
  selectableProviders,
  zeroSchemaProvider,
} from "../../../src/schema/providers/index.js";
import { openapiProvider } from "../../../src/schema/providers/openapi.js";
import { prismaProvider } from "../../../src/schema/providers/prisma.js";
import {
  KEY_ENV_CANDIDATES,
  supabaseProvider,
  URL_ENV_CANDIDATES,
} from "../../../src/schema/providers/supabase.js";
import { zodProvider } from "../../../src/schema/providers/zod.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

describe("schema providers", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("offers prisma, supabase, drizzle, openapi, zod in that order; zero-schema is not selectable", () => {
    expect(selectableProviders.map((provider) => provider.id)).toEqual([
      "prisma",
      "supabase",
      "drizzle",
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

    it("extract() rejects when the configured schema file is missing", async () => {
      await expect(
        prismaProvider.extract("/nowhere", {
          schemaPath: "prisma/schema.prisma",
        }),
      ).rejects.toThrow(/not found/);
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

    it("offers the project API as a second path when no types file or credentials were found", async () => {
      project = makeTempProject();
      // A dev machine exporting real Supabase credentials would send
      // configFields down its "credentials detected" branch instead.
      const conventional = [...URL_ENV_CANDIDATES, ...KEY_ENV_CANDIDATES];
      const ambient = conventional.map((name) => process.env[name]);
      for (const name of conventional) delete process.env[name];

      try {
        const fields = await supabaseProvider.configFields(project.dir);
        expect(fields.map((field) => [field.key, field.defaultValue])).toEqual([
          ["typesPath", "types/database.types.ts"],
          ["urlEnv", "NEXT_PUBLIC_SUPABASE_URL"],
          ["keyEnv", "SUPABASE_SERVICE_ROLE_KEY"],
          ["schema", "public"],
        ]);
      } finally {
        conventional.forEach((name, index) => {
          const value = ambient[index];
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        });
      }
    });

    it("counts a config as viable only when extract() would really have something", () => {
      project = makeTempProject({
        ".env.local":
          "ANTRA_TEST_SUPABASE_URL=https://abc.supabase.co\nANTRA_TEST_SUPABASE_KEY=service-key\n",
        "types/database.types.ts": "export type Database = {};\n",
      });
      const rootDir = project.dir;
      const viable = (config: unknown) =>
        supabaseProvider.isViable?.(rootDir, config);

      // A typesPath counts only if the file is really there.
      expect(
        viable({ id: "supabase", typesPath: "types/database.types.ts" }),
      ).toBe(true);
      expect(viable({ id: "supabase", typesPath: "types/typo.types.ts" })).toBe(
        false,
      );

      // Variable names with nothing behind them are not credentials.
      expect(
        viable({
          id: "supabase",
          urlEnv: "ANTRA_TEST_SUPABASE_URL",
          keyEnv: "ANTRA_TEST_SUPABASE_KEY",
        }),
      ).toBe(true);
      expect(
        viable({
          id: "supabase",
          urlEnv: "ANTRA_TEST_SUPABASE_URL",
          keyEnv: "ANTRA_TEST_ABSENT_KEY",
        }),
      ).toBe(false);

      // Two keys, and still nothing to extract from.
      expect(viable({ id: "supabase", schema: "public" })).toBe(false);
      expect(viable({ id: "supabase" })).toBe(false);
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
