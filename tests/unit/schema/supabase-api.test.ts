import { afterEach, describe, expect, it } from "vitest";

import { SchemaExtractionError } from "../../../src/schema/errors.js";
import { extractSources } from "../../../src/schema/extract.js";
import {
  detectSupabaseEnv,
  extractSupabaseApi,
  findTypesFile,
  supabaseProvider,
  type Fetcher,
} from "../../../src/schema/providers/supabase.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

const OPENAPI = {
  swagger: "2.0",
  definitions: {
    users: {
      properties: {
        id: { type: "string" },
        email: { type: "string" },
        password_hash: { type: "string" },
      },
    },
    invoices: {
      properties: { id: { type: "string" }, amount: { type: "integer" } },
    },
    "(rpc) do_thing": { properties: { arg: { type: "string" } } },
    empty_view: {},
  },
};

interface Recorded {
  url: string;
  headers: Record<string, string>;
}

function fakeFetch(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
): { fetch: Fetcher; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetch: Fetcher = (url, options) => {
    calls.push({ url, headers: options.headers });
    return Promise.resolve({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: init.statusText ?? "OK",
      text: () =>
        Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    });
  };
  return { fetch, calls };
}

describe("extractSupabaseApi", () => {
  it("turns the PostgREST schema document into taint sources", async () => {
    const { fetch, calls } = fakeFetch(OPENAPI);

    const sources = await extractSupabaseApi(
      {
        url: "https://abc.supabase.co/",
        key: "service-role-key",
        schema: "public",
      },
      fetch,
    );

    expect(calls[0]?.url).toBe("https://abc.supabase.co/rest/v1/");
    expect(calls[0]?.headers.apikey).toBe("service-role-key");
    expect(calls[0]?.headers["Accept-Profile"]).toBe("public");
    expect(sources).toEqual([
      { field: "id", origin: "supabase:public.users.id" },
      { field: "email", origin: "supabase:public.users.email" },
      { field: "password_hash", origin: "supabase:public.users.password_hash" },
      { field: "id", origin: "supabase:public.invoices.id" },
      { field: "amount", origin: "supabase:public.invoices.amount" },
    ]);
  });

  it("explains a rejected key without ever echoing it", async () => {
    const { fetch } = fakeFetch("", {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const error = await extractSupabaseApi(
      {
        url: "https://abc.supabase.co",
        key: "super-secret-key-value",
        schema: "public",
      },
      fetch,
    ).then(
      () => null,
      (cause: unknown) =>
        cause instanceof Error ? cause : new Error(String(cause)),
    );

    expect(error?.message).toMatch(/rejected the key \(401\)/);
    expect(error?.message).not.toContain("super-secret-key-value");
  });

  it("rejects a non-JSON body and a schema with no tables", async () => {
    await expect(
      extractSupabaseApi(
        { url: "https://abc.supabase.co", key: "k", schema: "public" },
        fakeFetch("<!doctype html>").fetch,
      ),
    ).rejects.toThrow(/did not return JSON/);

    await expect(
      extractSupabaseApi(
        { url: "https://abc.supabase.co", key: "k", schema: "private" },
        fakeFetch({ definitions: {} }).fetch,
      ),
    ).rejects.toThrow(/described no tables in schema "private"/);
  });
});

describe("supabase provider with env credentials", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("detects a project from its env file", async () => {
    project = makeTempProject({
      ".env.local":
        "NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=service-key\n",
    });

    expect(detectSupabaseEnv(project.dir)).toEqual({
      urlEnv: "NEXT_PUBLIC_SUPABASE_URL",
      keyEnv: "SUPABASE_SERVICE_ROLE_KEY",
    });
    expect(await supabaseProvider.detect(project.dir)).toBe(true);

    const fields = await supabaseProvider.configFields(project.dir);
    expect(fields.map((field) => [field.key, field.defaultValue])).toEqual([
      ["typesPath", ""],
      ["urlEnv", "NEXT_PUBLIC_SUPABASE_URL"],
      ["keyEnv", "SUPABASE_SERVICE_ROLE_KEY"],
      ["schema", "public"],
    ]);
  });

  it("prefers a generated types file when both are present", async () => {
    project = makeTempProject({
      ".env": "SUPABASE_URL=https://abc.supabase.co\nSUPABASE_ANON_KEY=anon\n",
      "types/database.types.ts": "export type Database = {};\n",
    });

    const fields = await supabaseProvider.configFields(project.dir);
    expect(fields.map((field) => field.key)).toEqual(["typesPath"]);
  });

  it("finds a types file outside the conventional locations", async () => {
    project = makeTempProject({
      ".env": "SUPABASE_URL=https://abc.supabase.co\nSUPABASE_ANON_KEY=anon\n",
      // Where a real project put it, which the candidate list misses.
      "docs/database.types.ts": "export type Database = { public: {} };\n",
      // A client, not types: it must not be offered.
      "lib/db.types.ts": "export const client = 1;\n",
    });

    expect(findTypesFile(project.dir)).toBe("docs/database.types.ts");
    const fields = await supabaseProvider.configFields(project.dir);
    expect(fields.map((field) => [field.key, field.defaultValue])).toEqual([
      ["typesPath", "docs/database.types.ts"],
    ]);
  });

  it("still offers the types path when only credentials were detected", async () => {
    project = makeTempProject({
      ".env.local":
        "NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=key\n",
    });

    const fields = await supabaseProvider.configFields(project.dir);
    expect(fields.map((field) => field.key)).toEqual([
      "typesPath",
      "urlEnv",
      "keyEnv",
      "schema",
    ]);
    expect(fields[0]?.defaultValue).toBe("");
  });

  it("says so when a file path was given where a variable name belongs", async () => {
    project = makeTempProject({ ".env": "X=1\n" });

    await expect(
      supabaseProvider.extract(project.dir, {
        id: "supabase",
        urlEnv: "docs/database.types.ts",
        keyEnv: "SUPABASE_SERVICE_ROLE_KEY",
      }),
    ).rejects.toThrow(/looks like a file path.*`typesPath`/s);
  });

  it("names the missing variable instead of failing anonymously", async () => {
    project = makeTempProject({
      ".env": "NEXT_PUBLIC_SUPABASE_URL=https://abc\n",
    });

    await expect(
      supabaseProvider.extract(project.dir, {
        id: "supabase",
        urlEnv: "NEXT_PUBLIC_SUPABASE_URL",
        keyEnv: "SUPABASE_SERVICE_ROLE_KEY",
        schema: "public",
      }),
    ).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY is not set/);
  });

  it("reports a provider failure as a SchemaExtractionError, naming the provider", async () => {
    project = makeTempProject({
      ".env": "NEXT_PUBLIC_SUPABASE_URL=https://abc\n",
    });

    const error = await extractSources(project.dir, [
      {
        id: "supabase",
        urlEnv: "NEXT_PUBLIC_SUPABASE_URL",
        keyEnv: "SUPABASE_SERVICE_ROLE_KEY",
      },
    ]).then(
      () => null,
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(SchemaExtractionError);
    expect((error as SchemaExtractionError).providerId).toBe("supabase");
    expect((error as Error).message).toMatch(
      /^supabase: SUPABASE_SERVICE_ROLE_KEY is not set/,
    );
  });

  it("rejects a config that names neither a types file nor env variables", async () => {
    project = makeTempProject({});
    await expect(
      supabaseProvider.extract(project.dir, { id: "supabase" }),
    ).rejects.toThrow(/needs either `typesPath`/);
  });
});
