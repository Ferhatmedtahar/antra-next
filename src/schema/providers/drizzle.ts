import path from "path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { z } from "zod";

import { findFirstExisting } from "../../utils/fs.js";
import { createSyntaxProject } from "../../utils/ts-project.js";
import type { SchemaProvider, TaintSource } from "../types.js";

const CONFIG_CANDIDATES = [
  "drizzle.config.ts",
  "drizzle.config.js",
  "drizzle.config.mjs",
] as const;

const SCHEMA_CANDIDATES = [
  "src/db/schema.ts",
  "db/schema.ts",
  "drizzle/schema.ts",
  "src/lib/db/schema.ts",
] as const;

const configSchema = z.object({ glob: z.string().min(1) });

const TABLE_BUILDERS = /(?:^|\.)(?:pgTable|mysqlTable|sqliteTable)$/;

/** `pgTable("users", {...})` or `pgTable("users", (t) => ({...}))`. */
function tableShape(argument: Node | undefined): Node | undefined {
  if (!argument) return undefined;
  if (Node.isArrowFunction(argument)) return tableShape(argument.getBody());
  if (Node.isParenthesizedExpression(argument)) {
    return tableShape(argument.getExpression());
  }
  return Node.isObjectLiteralExpression(argument) ? argument : undefined;
}

/**
 * Walks a builder chain like `text("password_hash").notNull().unique()`
 * down to the innermost call and returns its string argument, if any.
 */
function columnName(initializer: Node | undefined): string | undefined {
  let node = initializer;
  while (node && Node.isCallExpression(node)) {
    const [first] = node.getArguments();
    if (first && Node.isStringLiteral(first)) return first.getLiteralValue();
    const callee = node.getExpression();
    node = Node.isPropertyAccessExpression(callee)
      ? callee.getExpression()
      : undefined;
  }
  return undefined;
}

/**
 * One TaintSource per column of every `pgTable`/`mysqlTable`/`sqliteTable`
 * call. Uses the DB column name when the builder was given one
 * (`text("password_hash")`), else the property key.
 */
export function extractDrizzleTables(sourceFile: SourceFile): TaintSource[] {
  const sources: TaintSource[] = [];
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  )) {
    if (!TABLE_BUILDERS.test(call.getExpression().getText())) continue;
    const [nameArgument, shapeArgument] = call.getArguments();
    const shape = tableShape(shapeArgument);
    if (!nameArgument || !Node.isStringLiteral(nameArgument) || !shape)
      continue;
    if (!Node.isObjectLiteralExpression(shape)) continue;

    const table = nameArgument.getLiteralValue();
    for (const property of shape.getProperties()) {
      if (!Node.isPropertyAssignment(property)) continue;
      const field = columnName(property.getInitializer()) ?? property.getName();
      sources.push({ field, origin: `drizzle:${table}.${field}` });
    }
  }
  return sources;
}

/** Drizzle provider (ADR-002 Strategy A — schema-as-TypeScript variant). */
export const drizzleProvider: SchemaProvider = {
  id: "drizzle",
  label: "Drizzle (pgTable/mysqlTable/sqliteTable schema files)",
  dependencyPackages: ["drizzle-orm", "drizzle-kit"],

  detect(rootDir: string) {
    return Promise.resolve(
      findFirstExisting(rootDir, CONFIG_CANDIDATES) !== null ||
        findFirstExisting(rootDir, SCHEMA_CANDIDATES) !== null,
    );
  },

  configFields(rootDir: string) {
    const located = findFirstExisting(rootDir, SCHEMA_CANDIDATES);
    return Promise.resolve([
      {
        key: "glob",
        message: "Glob for your Drizzle schema file(s)",
        defaultValue: located ?? "src/db/schema*.ts",
      },
    ]);
  },

  extract(rootDir: string, config: unknown) {
    return Promise.resolve().then(() => {
      const { glob } = configSchema.parse(config);
      const project = createSyntaxProject([
        path.join(rootDir, glob),
        `!${path.join(rootDir, "**/node_modules/**")}`,
      ]);
      return project.getSourceFiles().flatMap(extractDrizzleTables);
    });
  },
};
