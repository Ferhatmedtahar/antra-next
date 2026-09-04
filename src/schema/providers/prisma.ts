import { findFirstExisting } from "../../utils/fs.js";
import { NotImplementedError } from "../errors.js";
import type { SchemaProvider } from "../types.js";

/** Prisma's own CLI default is `prisma/schema.prisma`; root is a rare alternative. */
const SCHEMA_CANDIDATES = ["prisma/schema.prisma", "schema.prisma"] as const;

/** Prisma provider (ADR-002 Strategy A — local DB schema). */
export const prismaProvider: SchemaProvider = {
  id: "prisma",
  label: "Prisma (schema.prisma)",
  dependencyPackages: ["@prisma/client", "prisma"],

  detect(rootDir: string) {
    return Promise.resolve(
      findFirstExisting(rootDir, SCHEMA_CANDIDATES) !== null,
    );
  },

  configFields(rootDir: string) {
    const located = findFirstExisting(rootDir, SCHEMA_CANDIDATES);
    return Promise.resolve([
      {
        key: "schemaPath",
        message: "Path to your Prisma schema",
        defaultValue: located ?? SCHEMA_CANDIDATES[0],
      },
    ]);
  },

  extract() {
    // Epic 03 / TASK-010: parse `model` blocks, one TaintSource per field.
    return Promise.reject(new NotImplementedError("prisma"));
  },
};
