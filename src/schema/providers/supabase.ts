import { findFirstExisting } from "../../utils/fs.js";
import { NotImplementedError } from "../errors.js";
import type { SchemaProvider } from "../types.js";

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

/** Supabase provider (ADR-002 Strategy A — generated-types variant). */
export const supabaseProvider: SchemaProvider = {
  id: "supabase",
  label: "Supabase (generated database.types.ts)",
  dependencyPackages: ["@supabase/supabase-js", "@supabase/ssr"],

  detect(rootDir: string) {
    return Promise.resolve(
      findFirstExisting(rootDir, TYPES_CANDIDATES) !== null,
    );
  },

  configFields(rootDir: string) {
    const located = findFirstExisting(rootDir, TYPES_CANDIDATES);
    return Promise.resolve([
      {
        key: "typesPath",
        message: "Path to your generated Supabase types file",
        defaultValue: located ?? TYPES_CANDIDATES[0],
      },
    ]);
  },

  extract() {
    // Epic 03 / TASK-011d: read the generated `Database` type via ts-morph's
    // type checker, one TaintSource per table Row field.
    return Promise.reject(new NotImplementedError("supabase"));
  },
};
