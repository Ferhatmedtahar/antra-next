import { NotImplementedError } from "../errors.js";
import type { SchemaProvider } from "../types.js";

/**
 * Shared Zod schema provider (ADR-002 Strategy C — shared DTOs).
 *
 * No auto-detect by design: having `zod` installed proves nothing — nearly
 * every project has it for something. Only reachable by the user enabling
 * it manually and supplying a glob.
 */
export const zodProvider: SchemaProvider = {
  id: "zod",
  label: "Shared Zod schemas / DTOs (glob)",

  detect() {
    return Promise.resolve(false);
  },

  configFields() {
    return Promise.resolve([
      {
        key: "glob",
        message: "Glob for files containing your shared Zod schemas",
        defaultValue: "**/*.schema.ts",
      },
    ]);
  },

  extract() {
    // Epic 03 / TASK-011b: find `z.object({...})` calls via ts-morph.
    return Promise.reject(new NotImplementedError("zod"));
  },
};
