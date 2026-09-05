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

import { findFirstExisting } from "../../utils/fs.js";
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

const configSchema = z.object({ typesPath: z.string().min(1) });

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

  extract(rootDir: string, config: unknown) {
    return Promise.resolve().then(() => {
      const { typesPath } = configSchema.parse(config);
      const filePath = path.resolve(rootDir, typesPath);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Supabase types file not found: ${typesPath}`);
      }
      return extractSupabaseTypes(filePath);
    });
  },
};
