import fs from "fs";
import path from "path";

export const GITIGNORE_MARKER =
  "# boundary-guard (managed block — the snapshot and baseline are meant to be committed)";

/** Local-only artifacts. NOT the snapshot: CI reads it, so it stays in git (ADR-001 NFR3). */
export const GITIGNORE_ENTRIES: readonly string[] = [
  ".boundary-guard/*.sqlite",
  ".boundary-guard/*.sqlite-journal",
  ".boundary-guard/*.sqlite-wal",
  ".boundary-guard/*.sqlite-shm",
  ".boundary-guard/scan.json",
  ".boundary-guard/cache/",
];

export type GitignoreStatus = "created" | "appended" | "unchanged";

/**
 * Makes sure the target project's .gitignore carries the managed block.
 * Idempotent: the marker line is the only thing checked, so the user can
 * edit the entries underneath and this never re-appends.
 */
export async function ensureGitignore(
  rootDir: string,
): Promise<{ status: GitignoreStatus; path: string }> {
  const target = path.join(rootDir, ".gitignore");
  const block = [GITIGNORE_MARKER, ...GITIGNORE_ENTRIES].join("\n") + "\n";

  if (!fs.existsSync(target)) {
    await fs.promises.writeFile(target, block, "utf8");
    return { status: "created", path: target };
  }

  const existing = await fs.promises.readFile(target, "utf8");
  if (existing.includes(GITIGNORE_MARKER)) {
    return { status: "unchanged", path: target };
  }

  const separator =
    existing.length === 0 || existing.endsWith("\n") ? "\n" : "\n\n";
  await fs.promises.writeFile(
    target,
    `${existing}${separator}${block}`,
    "utf8",
  );
  return { status: "appended", path: target };
}
