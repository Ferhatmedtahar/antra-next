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
