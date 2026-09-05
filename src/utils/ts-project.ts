import { Project, ts } from "ts-morph";

/** Compiler options for syntax-level work where no tsconfig is in play. */
export const SYNTAX_COMPILER_OPTIONS = {
  jsx: ts.JsxEmit.Preserve,
  allowJs: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  skipLibCheck: true,
};

/**
 * A throwaway Project over the given globs/paths that never chases imports —
 * for providers that only need to read declarations in the matched files.
 */
export function createSyntaxProject(paths: readonly string[]): Project {
  const project = new Project({
    compilerOptions: SYNTAX_COMPILER_OPTIONS,
    skipFileDependencyResolution: true,
  });
  project.addSourceFilesAtPaths([...paths]);
  return project;
}
