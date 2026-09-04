import path from "path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { z } from "zod";

import { createSyntaxProject } from "../../utils/ts-project.js";
import type { SchemaProvider, TaintSource } from "../types.js";

const configSchema = z.object({ glob: z.string().min(1) });

const OBJECT_BUILDERS = /^(?:z|zod)\.(?:object|strictObject|looseObject)$/;

function declarationName(node: Node): string {
  const declaration = node.getFirstAncestorByKind(
    SyntaxKind.VariableDeclaration,
  );
  return declaration?.getName() ?? "<anonymous>";
}

/** One TaintSource per key of every `z.object({...})` literal in the file. */
export function extractZodObjects(
  sourceFile: SourceFile,
  displayPath: string,
): TaintSource[] {
  const sources: TaintSource[] = [];
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  )) {
    if (!OBJECT_BUILDERS.test(call.getExpression().getText())) continue;
    const [shape] = call.getArguments();
    if (!shape || !Node.isObjectLiteralExpression(shape)) continue;
    const owner = declarationName(call);
    for (const property of shape.getProperties()) {
      if (
        !Node.isPropertyAssignment(property) &&
        !Node.isShorthandPropertyAssignment(property)
      ) {
        continue;
      }
      const field = property.getName().replace(/^["']|["']$/g, "");
      sources.push({ field, origin: `zod:${displayPath}:${owner}.${field}` });
    }
  }
  return sources;
}

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

  extract(rootDir: string, config: unknown) {
    return Promise.resolve().then(() => {
      const { glob } = configSchema.parse(config);
      const project = createSyntaxProject([
        path.join(rootDir, glob),
        `!${path.join(rootDir, "**/node_modules/**")}`,
      ]);
      return project
        .getSourceFiles()
        .flatMap((sourceFile) =>
          extractZodObjects(
            sourceFile,
            path.relative(rootDir, sourceFile.getFilePath()),
          ),
        );
    });
  },
};
