import { fileURLToPath } from "url";

import { describe, expect, it } from "vitest";

import { extractSources } from "../../../src/schema/extract.js";
import { NotImplementedError } from "../../../src/schema/errors.js";
import { drizzleProvider } from "../../../src/schema/providers/drizzle.js";
import { openapiProvider } from "../../../src/schema/providers/openapi.js";
import { prismaProvider } from "../../../src/schema/providers/prisma.js";
import { supabaseProvider } from "../../../src/schema/providers/supabase.js";
import { zodProvider } from "../../../src/schema/providers/zod.js";
import type { SchemaProvider, TaintSource } from "../../../src/schema/types.js";

const SCHEMAS = fileURLToPath(
  new URL("../../fixtures/schemas/", import.meta.url),
);

const fields = (sources: TaintSource[]) => sources.map((s) => s.field).sort();
const origins = (sources: TaintSource[]) => sources.map((s) => s.origin).sort();

describe("supabase extract()", () => {
  it("reads every Row of Tables and Views, skipping Insert/Update/Enums/__Internal", async () => {
    const sources = await supabaseProvider.extract(SCHEMAS, {
      typesPath: "database.types.ts",
    });

    expect(origins(sources)).toEqual([
      "supabase:public.active_users.email",
      "supabase:public.active_users.id",
      "supabase:public.sessions.id",
      "supabase:public.sessions.refresh_token",
      "supabase:public.sessions.user_id",
      "supabase:public.users.created_at",
      "supabase:public.users.email",
      "supabase:public.users.id",
      "supabase:public.users.password_hash",
    ]);
  });

  it("rejects a missing file and a file without a Database type", async () => {
    await expect(
      supabaseProvider.extract(SCHEMAS, { typesPath: "nope.ts" }),
    ).rejects.toThrow(/not found/);
    await expect(
      supabaseProvider.extract(SCHEMAS, { typesPath: "user.schema.ts" }),
    ).rejects.toThrow(/no `Database` type/);
  });
});

describe("prisma extract()", () => {
  it("emits columns, keeps FK scalars, skips relation fields and @@ lines", async () => {
    const sources = await prismaProvider.extract(SCHEMAS, {
      schemaPath: "schema.prisma",
    });

    expect(origins(sources)).toEqual([
      "prisma:Post.authorId",
      "prisma:Post.id",
      "prisma:Post.title",
      "prisma:User.email",
      "prisma:User.id",
      "prisma:User.passwordHash",
      "prisma:User.role",
      "prisma:User.tags",
    ]);
  });

  it("handles a one-line model", async () => {
    const { parsePrismaSchema } =
      await import("../../../src/schema/providers/prisma.js");
    expect(
      fields(parsePrismaSchema("model User { password_hash String }")),
    ).toEqual(["password_hash"]);
  });
});

describe("openapi extract()", () => {
  it("walks OpenAPI 3 components.schemas incl. nested objects and allOf", async () => {
    const sources = await openapiProvider.extract(SCHEMAS, {
      spec: "openapi.json",
    });

    expect(origins(sources)).toEqual([
      "openapi:Base.id",
      "openapi:Token.access_token",
      "openapi:User.apiKey",
      "openapi:User.id",
      "openapi:User.profile",
      "openapi:User.profile.ssn",
    ]);
  });

  it("walks Swagger 2 definitions from YAML (what PostgREST serves)", async () => {
    const sources = await openapiProvider.extract(SCHEMAS, {
      spec: "postgrest.yaml",
    });

    expect(origins(sources)).toEqual([
      "openapi:accounts.id",
      "openapi:accounts.stripe_customer_id",
    ]);
  });
});

describe("zod extract()", () => {
  it("reads every z.object / z.strictObject key in matching files, nested included", async () => {
    const sources = await zodProvider.extract(SCHEMAS, { glob: "*.schema.ts" });

    expect(origins(sources)).toEqual([
      "zod:user.schema.ts:loginInput.api-key",
      "zod:user.schema.ts:loginInput.email",
      "zod:user.schema.ts:userSchema.address",
      "zod:user.schema.ts:userSchema.id",
      "zod:user.schema.ts:userSchema.password",
      "zod:user.schema.ts:userSchema.street",
    ]);
  });
});

describe("drizzle extract()", () => {
  it("prefers the DB column name over the property key, handles chains and callback form", async () => {
    const sources = await drizzleProvider.extract(SCHEMAS, {
      glob: "drizzle-schema.ts",
    });

    expect(origins(sources)).toEqual([
      "drizzle:sessions.token",
      "drizzle:sessions.user_id",
      "drizzle:users.id",
      "drizzle:users.nickname",
      "drizzle:users.password_hash",
    ]);
  });
});

describe("extractSources()", () => {
  const stubbed: SchemaProvider = {
    id: "stubbed",
    label: "stubbed",
    detect: () => Promise.resolve(false),
    configFields: () => Promise.resolve([]),
    extract: () => Promise.reject(new NotImplementedError("stubbed")),
  };
  const resolve = (id: string) =>
    [prismaProvider, supabaseProvider, stubbed].find((p) => p.id === id);

  it("unions providers, dedupes by origin, and reports unimplemented ones as skipped", async () => {
    const { sources, skipped } = await extractSources(
      SCHEMAS,
      [
        { id: "prisma", schemaPath: "schema.prisma" },
        { id: "prisma", schemaPath: "schema.prisma" },
        { id: "supabase", typesPath: "database.types.ts" },
        { id: "stubbed" },
      ],
      resolve,
    );

    expect(sources).toHaveLength(8 + 9);
    expect(skipped).toEqual([
      { id: "stubbed", reason: expect.stringContaining("not implemented") },
    ]);
  });

  it("rejects an unknown provider id and names the provider on real failures", async () => {
    await expect(
      extractSources(SCHEMAS, [{ id: "nope" }], resolve),
    ).rejects.toThrow(/Unknown schema provider/);
    await expect(
      extractSources(
        SCHEMAS,
        [{ id: "prisma", schemaPath: "missing.prisma" }],
        resolve,
      ),
    ).rejects.toThrow(/^prisma: .*not found/);
  });
});
