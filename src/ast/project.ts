import fs from "fs";
import path from "path";

import { Project, type SourceFile } from "ts-morph";

import { SYNTAX_COMPILER_OPTIONS } from "../utils/ts-project.js";

export interface LoadedProject {
  project: Project;
  sourceFiles: SourceFile[];
}

const IGNORED_DIRS = [
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
] as const;

/**
 * Loads every .ts/.tsx/.js/.jsx file under rootDir into one ts-morph
 * Project (C1 in docs/c4). Uses the target's tsconfig.json for compiler
 * options (path aliases matter for the import graph later) but ignores its
 * include/exclude — we always scan the whole tree minus build output.
 */
export function loadProject(rootDir: string): LoadedProject {
  const project = createProject(rootDir);
  project.addSourceFilesAtPaths([
    path.join(rootDir, "**/*.{ts,tsx,js,jsx}"),
    `!${path.join(rootDir, "**/*.d.ts")}`,
    ...IGNORED_DIRS.map((dir) => `!${path.join(rootDir, "**", dir, "**")}`),
  ]);
  return { project, sourceFiles: project.getSourceFiles() };
}

function createProject(rootDir: string): Project {
  const tsConfigFilePath = path.join(rootDir, "tsconfig.json");
  if (fs.existsSync(tsConfigFilePath)) {
    try {
      return new Project({
        tsConfigFilePath,
        skipAddingFilesFromTsConfig: true,
      });
    } catch {
      // Unreadable/extends-missing tsconfig: fall through to defaults rather
      // than refuse to scan.
    }
  }
  return new Project({ compilerOptions: SYNTAX_COMPILER_OPTIONS });
}
