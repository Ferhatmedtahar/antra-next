import fs from "fs";
import path from "path";

import {
  Project,
  type InterfaceDeclaration,
  type Symbol as MorphSymbol,
  type Type,
  type TypeAliasDeclaration,
} from "ts-morph";
import { z } from "zod";

import { findEnvVar, readProjectEnv, redact } from "../../utils/env.js";
import { findFirstExisting, findShallow } from "../../utils/fs.js";
import { SYNTAX_COMPILER_OPTIONS } from "../../utils/ts-project.js";
import type { SchemaProvider, TaintSource } from "../types.js";

/**
 * There's no single blessed location: the developer chose where to save
 * the output of `supabase gen types typescript ...`. These are the
 * conventional spots, most common first.
 */
const TYPES_CANDIDATES = [
  "types/database.types.ts",
  "src/types/database.types.ts",
  "lib/database.types.ts",
  "src/lib/database.types.ts",
  "supabase/database.types.ts",
  "database.types.ts",
  "types/supabase.ts",
  "src/types/supabase.ts",
] as const;

/**
 * Names worth finding anywhere in the tree. Deliberately not `supabase.ts`,
 * which is far more often the client than the types.
 */
const TYPES_FILENAMES = [
  "database.types.ts",
  "supabase.types.ts",
  "db.types.ts",
] as const;

const DECLARES_DATABASE = /(?:type|interface)\s+Database\b/;

/**
 * The generated types file, wherever the developer put it: the
 * conventional spots first, then any file with a known name that actually
 * declares a `Database` type. `docs/database.types.ts` is a real example
 * the conventional list alone would miss.
 */
export function findTypesFile(rootDir: string): string | null {
  const conventional = findFirstExisting(rootDir, TYPES_CANDIDATES);
  if (conventional) return conventional;
  return findShallow(rootDir, {
    names: TYPES_FILENAMES,
    accept: (absolute) => {
      try {
        return DECLARES_DATABASE.test(fs.readFileSync(absolute, "utf8"));
      } catch {
        return false;
      }
    },
  });
}

/** Env var names Supabase projects conventionally use, most common first. */
export const URL_ENV_CANDIDATES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PROJECT_URL",
] as const;

/**
 * Service role first: it sees every table. The anon key still returns the
 * full schema document, because PostgREST describes the schema regardless
 * of row-level security, so it's a fine fallback.
 */
export const KEY_ENV_CANDIDATES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

const typesConfigSchema = z.object({ typesPath: z.string().min(1) });
const apiConfigSchema = z.object({
  urlEnv: z.string().min(1),
  keyEnv: z.string().min(1),
  schema: z.string().min(1).default("public"),
});

/** Table-like groups inside a schema whose members carry a `Row` shape. */
const ROW_GROUPS = ["Tables", "Views"] as const;

type DatabaseDeclaration = TypeAliasDeclaration | InterfaceDeclaration;

function propertyType(
  owner: Type,
  name: string,
  location: DatabaseDeclaration,
): Type | undefined {
  return owner.getProperty(name)?.getTypeAtLocation(location);
}

/**
 * Reads the generated `Database` type via the type checker (not text) so
 * aliases, `Json`, enum references and future codegen tweaks don't matter —
 * only the resolved property names of each table's `Row` do.
 */
export function extractSupabaseTypes(filePath: string): TaintSource[] {
  const project = new Project({
    compilerOptions: SYNTAX_COMPILER_OPTIONS,
    skipFileDependencyResolution: true,
  });
  const sourceFile = project.addSourceFileAtPath(filePath);
  const database: DatabaseDeclaration | undefined =
    sourceFile.getTypeAlias("Database") ?? sourceFile.getInterface("Database");
  if (!database) {
    throw new Error(
      `${filePath} has no \`Database\` type — is this a Supabase-generated types file?`,
    );
  }

  const sources: TaintSource[] = [];
  const schemaSymbols: MorphSymbol[] = database.getType().getProperties();
  for (const schemaSymbol of schemaSymbols) {
    const schemaName = schemaSymbol.getName();
    if (schemaName.startsWith("__")) continue;
    const schemaType: Type = schemaSymbol.getTypeAtLocation(database);

    for (const group of ROW_GROUPS) {
      const groupType = propertyType(schemaType, group, database);
      if (!groupType) continue;

      const tableSymbols: MorphSymbol[] = groupType.getProperties();
      for (const tableSymbol of tableSymbols) {
        const tableType: Type = tableSymbol.getTypeAtLocation(database);
        const rowType = propertyType(tableType, "Row", database);
        if (!rowType) continue;

        const table = tableSymbol.getName();
        const columns: MorphSymbol[] = rowType.getProperties();
        for (const column of columns) {
          const field = column.getName();
          sources.push({
            field,
            origin: `supabase:${schemaName}.${table}.${field}`,
          });
        }
      }
    }
  }
  return sources;
}

/** The Swagger 2.0 document PostgREST serves at the REST root. */
const openApiSchema = z.object({
  definitions: z
    .record(
      z.string(),
      z.object({ properties: z.record(z.string(), z.unknown()).optional() }),
    )
    .default({}),
});

export type Fetcher = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

export interface ApiOptions {
  url: string;
  key: string;
  schema: string;
  timeoutMs?: number;
}

/**
 * Asks PostgREST to describe itself. Every table and view in the schema
 * comes back as an OpenAPI definition whose properties are the columns —
 * no database connection, no extra dependency, and it works with the anon
 * key because the schema document isn't row-level-security gated.
 *
 * The key is only ever a request header: it is never logged, never
 * written to the config, and scrubbed out of any error we raise.
 */
export async function extractSupabaseApi(
  options: ApiOptions,
  fetchImpl: Fetcher = globalThis.fetch,
): Promise<TaintSource[]> {
  const base = options.url.replace(/\/+$/, "");
  const endpoint = `${base}/rest/v1/`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15000,
  );

  let body: string;
  try {
    const response = await fetchImpl(endpoint, {
      headers: {
        apikey: options.key,
        Authorization: `Bearer ${options.key}`,
        "Accept-Profile": options.schema,
        Accept: "application/openapi+json, application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? `Supabase rejected the key (${response.status}). Check the value of your key variable; a service role or anon key from the same project is required.`
          : `Supabase returned ${response.status} ${response.statusText} for ${endpoint}`,
      );
    }
    body = await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      redact(
        options.key,
        controller.signal.aborted
          ? `Supabase did not answer within the timeout at ${endpoint}`
          : message,
      ),
    );
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(
      `${endpoint} did not return JSON — is that the project URL rather than a page?`,
    );
  }
  const document = openApiSchema.parse(parsed);

  const sources: TaintSource[] = [];
  for (const [table, definition] of Object.entries(document.definitions)) {
    // PostgREST lists stored procedures as `(rpc) name`; their properties
    // are arguments, not columns.
    if (table.startsWith("(")) continue;
    for (const field of Object.keys(definition.properties ?? {})) {
      sources.push({
        field,
        origin: `supabase:${options.schema}.${table}.${field}`,
      });
    }
  }
  if (sources.length === 0) {
    throw new Error(
      `Supabase answered but described no tables in schema "${options.schema}".`,
    );
  }
  return sources;
}

/** Supabase project credentials found in the environment, names only kept. */
export function detectSupabaseEnv(
  rootDir: string,
): { urlEnv: string; keyEnv: string } | null {
  const env = readProjectEnv(rootDir);
  const url = findEnvVar(env, URL_ENV_CANDIDATES);
  const key = findEnvVar(env, KEY_ENV_CANDIDATES);
  return url && key ? { urlEnv: url.name, keyEnv: key.name } : null;
}

/**
 * Supabase provider (ADR-002 Strategy A). Two ways in, in preference
 * order: the generated types file when it exists, otherwise the project's
 * own env vars, reading the schema straight from PostgREST.
 */
export const supabaseProvider: SchemaProvider = {
  id: "supabase",
  label: "Supabase (generated types, or your project's API)",
  dependencyPackages: ["@supabase/supabase-js", "@supabase/ssr"],

  detect(rootDir: string) {
    return Promise.resolve(
      findTypesFile(rootDir) !== null || detectSupabaseEnv(rootDir) !== null,
    );
  },

  configFields(rootDir: string) {
    const located = findTypesFile(rootDir);
    // A types file needs no credentials, so when one exists that's the
    // only question worth asking.
    if (located) {
      return Promise.resolve([
        {
          key: "typesPath",
          message: "Path to your generated Supabase types file",
          defaultValue: located,
        },
      ]);
    }
    const fromEnv = detectSupabaseEnv(rootDir);
    if (fromEnv) {
      return Promise.resolve([
        {
          key: "typesPath",
          message:
            "Path to your generated Supabase types file, if you have one (leave empty to read the schema from your Supabase project instead)",
          defaultValue: "",
        },
        {
          key: "urlEnv",
          message:
            "Otherwise, the NAME of the env variable holding your Supabase project URL",
          defaultValue: fromEnv.urlEnv,
        },
        {
          key: "keyEnv",
          message:
            "And the NAME of the env variable holding a Supabase API key (read at scan time, never stored)",
          defaultValue: fromEnv.keyEnv,
        },
        {
          key: "schema",
          message: "Postgres schema to read",
          defaultValue: "public",
        },
      ]);
    }
    return Promise.resolve([
      {
        key: "typesPath",
        message:
          "Path to your generated Supabase types file (run `supabase gen types typescript` first), or leave empty to read the schema from your Supabase project instead",
        defaultValue: TYPES_CANDIDATES[0],
      },
      {
        key: "urlEnv",
        message:
          "Otherwise, the NAME of the env variable holding your Supabase project URL",
        defaultValue: URL_ENV_CANDIDATES[0],
      },
      {
        key: "keyEnv",
        message:
          "And the NAME of the env variable holding a Supabase API key (read at scan time, never stored)",
        defaultValue: KEY_ENV_CANDIDATES[0],
      },
      {
        key: "schema",
        message: "Postgres schema to read",
        defaultValue: "public",
      },
    ]);
  },

  async extract(rootDir: string, config: unknown) {
    const asTypes = typesConfigSchema.safeParse(config);
    if (asTypes.success) {
      const filePath = path.resolve(rootDir, asTypes.data.typesPath);
      if (!fs.existsSync(filePath)) {
        throw new Error(
          `Supabase types file not found: ${asTypes.data.typesPath}`,
        );
      }
      return extractSupabaseTypes(filePath);
    }

    const asApi = apiConfigSchema.safeParse(config);
    if (!asApi.success) {
      throw new Error(
        "Supabase config needs either `typesPath`, or `urlEnv` and `keyEnv` naming the environment variables that hold your project URL and key.",
      );
    }
    const { urlEnv, keyEnv, schema } = asApi.data;
    for (const [key, value] of [
      ["urlEnv", urlEnv],
      ["keyEnv", keyEnv],
    ] as const) {
      if (value.includes("/") || value.endsWith(".ts")) {
        throw new Error(
          `\`${key}\` is the NAME of an environment variable, but "${value}" looks like a file path. If that's your generated types file, set \`typesPath\` to it instead.`,
        );
      }
    }
    const env = readProjectEnv(rootDir);
    const url = env[urlEnv]?.trim();
    const key = env[keyEnv]?.trim();
    if (!url || !key) {
      const missing = [!url ? urlEnv : null, !key ? keyEnv : null]
        .filter((name): name is string => name !== null)
        .join(" and ");
      throw new Error(
        `${missing} is not set. Add it to .env.local or export it, then run \`antra sync\`. The value is read at scan time and never written to disk.`,
      );
    }
    return extractSupabaseApi({ url, key, schema });
  },

  /**
   * Mirrors extract()'s own precedence, so "init accepted this" and
   * "extract() accepted this" cannot disagree. `typesPath` counts only if
   * the file is really there; the API fallback only if both named
   * variables hold a value.
   *
   * Values are checked here purely to catch names that are configured but
   * point at nothing — the authoritative read still happens at scan time,
   * so rotating a key never means re-running init.
   */
  isViable(rootDir: string, config: unknown): boolean {
    const asTypes = typesConfigSchema.safeParse(config);
    if (asTypes.success) {
      return fs.existsSync(path.resolve(rootDir, asTypes.data.typesPath));
    }
    const asApi = apiConfigSchema.safeParse(config);
    if (!asApi.success) return false;
    const env = readProjectEnv(rootDir);
    const { urlEnv, keyEnv } = asApi.data;
    return (
      (env[urlEnv] ?? "").trim() !== "" && (env[keyEnv] ?? "").trim() !== ""
    );
  },
};
