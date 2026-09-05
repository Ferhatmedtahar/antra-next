import fs from "fs";
import path from "path";

/**
 * Returns the first candidate (relative to rootDir) that exists on disk,
 * or null. Candidates are checked in order, so list the most conventional
 * location first.
 */
export function findFirstExisting(
  rootDir: string,
  candidates: readonly string[],
): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(rootDir, candidate))) return candidate;
  }
  return null;
}

const DEFAULT_SKIP = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".boundary-guard",
  ".turbo",
  ".vercel",
] as const;

export interface ShallowSearch {
  /** Exact file names to look for. */
  names: readonly string[];
  /** How many directories below rootDir to descend. */
  maxDepth?: number;
  skip?: readonly string[];
  /** Last say on a hit, e.g. "does this file really declare what we need". */
  accept?: (absolutePath: string) => boolean;
}

/**
 * Breadth-first hunt for a file by name, so the shallowest match wins and
 * a deep monorepo never turns detection into a full-tree walk. Returns the
 * path relative to rootDir with forward slashes, or null.
 */
export function findShallow(
  rootDir: string,
  options: ShallowSearch,
): string | null {
  const maxDepth = options.maxDepth ?? 4;
  const skip = new Set(options.skip ?? DEFAULT_SKIP);
  const wanted = new Set(options.names);
  let level: string[] = [rootDir];

  for (let depth = 0; depth <= maxDepth && level.length > 0; depth++) {
    const next: string[] = [];
    for (const directory of level) {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!skip.has(entry.name) && !entry.name.startsWith(".")) {
            next.push(absolute);
          }
          continue;
        }
        if (!wanted.has(entry.name)) continue;
        if (options.accept && !options.accept(absolute)) continue;
        return path.relative(rootDir, absolute).split(path.sep).join("/");
      }
    }
    level = next;
  }
  return null;
}
