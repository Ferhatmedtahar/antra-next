import fs from "fs";
import path from "path";

import { z } from "zod";

import { findFirstExisting } from "../../utils/fs.js";
import type { SchemaProvider, TaintSource } from "../types.js";

/** Prisma's own CLI default is `prisma/schema.prisma`; root is a rare alternative. */
const SCHEMA_CANDIDATES = ["prisma/schema.prisma", "schema.prisma"] as const;

const configSchema = z.object({ schemaPath: z.string().min(1) });

/** Model bodies never contain `}` (attributes use `()`/`[]`), so this is safe for one-line models too. */
const MODEL_BLOCK = /\bmodel\s+(\w+)\s*\{([^}]*)\}/g;

/**
 * Parses `.prisma` text: one TaintSource per column of every `model`.
 * Relation fields (typed as another model, or carrying `@relation`) aren't
 * columns and are skipped; the foreign-key scalars next to them are kept.
 */
export function parsePrismaSchema(text: string): TaintSource[] {
  const blocks = [...text.matchAll(MODEL_BLOCK)];
  const modelNames = new Set(blocks.map((match) => match[1]));
  const sources: TaintSource[] = [];

  for (const [, model = "", body = ""] of blocks) {
    for (const rawLine of body.split("\n")) {
      const line = rawLine.replace(/\/\/.*$/, "").trim();
      if (!line || line.startsWith("@@")) continue;
      const [field, type] = line.split(/\s+/);
      if (!field || !type) continue;
      const baseType = type.replace(/[?[\]]/g, "");
      if (modelNames.has(baseType) || line.includes("@relation")) continue;
      sources.push({ field, origin: `prisma:${model}.${field}` });
    }
  }
  return sources;
}

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

  async extract(rootDir: string, config: unknown) {
    const { schemaPath } = configSchema.parse(config);
    const filePath = path.resolve(rootDir, schemaPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prisma schema not found: ${schemaPath}`);
    }
    return parsePrismaSchema(await fs.promises.readFile(filePath, "utf8"));
  },
};
