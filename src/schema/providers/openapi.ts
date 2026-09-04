import { findFirstExisting } from "../../utils/fs.js";
import { NotImplementedError } from "../errors.js";
import type { SchemaProvider } from "../types.js";

const SPEC_CANDIDATES = [
  "openapi.json",
  "openapi.yaml",
  "openapi.yml",
  "swagger.json",
  "swagger.yaml",
  "swagger.yml",
] as const;

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

  extract() {
    // Epic 03 / TASK-011a: read/fetch the spec, walk components.schemas.
    return Promise.reject(new NotImplementedError("openapi"));
  },
};
