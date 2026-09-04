import fs from "fs";
import path from "path";

import { parse as parseYaml } from "yaml";
import { z } from "zod";

import { findFirstExisting } from "../../utils/fs.js";
import type { SchemaProvider, TaintSource } from "../types.js";

const SPEC_CANDIDATES = [
  "openapi.json",
  "openapi.yaml",
  "openapi.yml",
  "swagger.json",
  "swagger.yaml",
  "swagger.yml",
] as const;

const configSchema = z.object({
  spec: z.string().min(1),
  /** Extra request headers for URL specs (e.g. an `apikey`). */
  headers: z.record(z.string(), z.string()).optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses JSON first, YAML as the fallback — YAML is a superset, so this never mis-parses JSON. */
export function parseSpecText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return parseYaml(text);
  }
}

function collectProperties(
  schema: unknown,
  name: string,
  out: TaintSource[],
): void {
  if (!isRecord(schema)) return;
  if (isRecord(schema.properties)) {
    for (const [field, sub] of Object.entries(schema.properties)) {
      out.push({ field, origin: `openapi:${name}.${field}` });
      collectProperties(sub, `${name}.${field}`, out);
    }
  }
  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf) collectProperties(part, name, out);
  }
  if (isRecord(schema.items)) collectProperties(schema.items, `${name}[]`, out);
}

/**
 * Walks both OpenAPI 3 (`components.schemas`) and Swagger 2 (`definitions`)
 * — PostgREST/Supabase serve the latter — emitting one TaintSource per
 * property, recursing into nested objects and arrays.
 */
export function extractOpenApiSpec(spec: unknown): TaintSource[] {
  if (!isRecord(spec)) throw new Error("OpenAPI spec is not an object");
  const components = isRecord(spec.components) ? spec.components : {};
  const schemas = {
    ...(isRecord(spec.definitions) ? spec.definitions : {}),
    ...(isRecord(components.schemas) ? components.schemas : {}),
  };
  const sources: TaintSource[] = [];
  for (const [name, schema] of Object.entries(schemas)) {
    collectProperties(schema, name, sources);
  }
  return sources;
}

async function loadSpec(
  rootDir: string,
  spec: string,
  headers: Record<string, string> | undefined,
): Promise<unknown> {
  if (/^https?:\/\//.test(spec)) {
    const response = await fetch(spec, headers ? { headers } : undefined);
    if (!response.ok) {
      throw new Error(
        `Fetching OpenAPI spec failed (${response.status}) — ${spec}`,
      );
    }
    return parseSpecText(await response.text());
  }
  const filePath = path.resolve(rootDir, spec);
  if (!fs.existsSync(filePath)) {
    throw new Error(`OpenAPI spec not found: ${spec}`);
  }
  return parseSpecText(await fs.promises.readFile(filePath, "utf8"));
}

/**
 * OpenAPI/Swagger provider (ADR-002 Strategy B — external backend contract).
 *
 * Weakest auto-detect of the set: the spec usually describes a backend in
 * another repo, reachable by URL, so detect() only finds a committed local
 * copy. Expect false most of the time — the manual prompt is the primary
 * path here, not a fallback. No dependencyPackages: nothing in package.json
 * means "this app talks to an OpenAPI-described backend".
 */
export const openapiProvider: SchemaProvider = {
  id: "openapi",
  label: "OpenAPI / Swagger spec (file or URL)",

  detect(rootDir: string) {
    return Promise.resolve(
      findFirstExisting(rootDir, SPEC_CANDIDATES) !== null,
    );
  },

  configFields(rootDir: string) {
    const located = findFirstExisting(rootDir, SPEC_CANDIDATES);
    return Promise.resolve([
      {
        key: "spec",
        message: "Path or URL to your OpenAPI/Swagger spec",
        defaultValue: located ?? "",
      },
    ]);
  },

  async extract(rootDir: string, config: unknown) {
    const { spec, headers } = configSchema.parse(config);
    return extractOpenApiSpec(await loadSpec(rootDir, spec, headers));
  },
};
