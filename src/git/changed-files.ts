import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const run = promisify(execFile);

export type ChangeMode = "staged" | "diff";

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

/** Refs tried, in order, when `--diff` is used without `--base`. */
const BASE_CANDIDATES = ["origin/main", "main", "origin/master", "master"];

async function git(rootDir: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await run("git", args, {
      cwd: rootDir,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === "ENOENT") {
      throw new GitError("git is not installed or not on PATH.");
    }
    const stderr = failure.stderr?.trim() ?? failure.message;
    if (/not a git repository/i.test(stderr)) {
      throw new GitError(`${rootDir} is not inside a git repository.`);
    }
    throw new GitError(`git ${args[0] ?? ""} failed: ${stderr}`);
  }
}

function splitNul(output: string): string[] {
  return output.split("\0").filter((entry) => entry.length > 0);
}

async function refExists(rootDir: string, ref: string): Promise<boolean> {
  try {
    await git(rootDir, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

export interface ChangedFiles {
  /** Absolute paths, under rootDir only. */
  files: string[];
  /** The ref the diff was taken against (null for staged). */
  base: string | null;
}

/**
 * Files to limit a scan to. `staged` = what's in the index (pre-commit);
 * `diff` = everything different from the merge-base with the base branch,
 * including uncommitted and untracked files (what a PR would contain).
 */
export async function listChangedFiles(
  rootDir: string,
  mode: ChangeMode,
  base?: string,
): Promise<ChangedFiles> {
  const top = (await git(rootDir, ["rev-parse", "--show-toplevel"])).trim();
  let relative: string[];
  let resolvedBase: string | null = null;

  if (mode === "staged") {
    relative = splitNul(
      await git(rootDir, [
        "diff",
        "--name-only",
        "--cached",
        "--diff-filter=ACMR",
        "-z",
      ]),
    );
  } else {
    resolvedBase = base ?? null;
    if (resolvedBase === null) {
      for (const candidate of BASE_CANDIDATES) {
        if (await refExists(rootDir, candidate)) {
          resolvedBase = candidate;
          break;
        }
      }
    }
    if (resolvedBase === null) {
      throw new GitError(
        `No base branch found (tried ${BASE_CANDIDATES.join(", ")}); pass --base <ref>.`,
      );
    }
    if (!(await refExists(rootDir, resolvedBase))) {
      throw new GitError(`Base ref "${resolvedBase}" does not exist.`);
    }
    const mergeBase = (
      await git(rootDir, ["merge-base", "HEAD", resolvedBase])
    ).trim();
    relative = [
      ...splitNul(
        await git(rootDir, [
          "diff",
          "--name-only",
          "--diff-filter=ACMR",
          "-z",
          mergeBase,
        ]),
      ),
      ...splitNul(
        await git(rootDir, [
          "ls-files",
          "--others",
          "--exclude-standard",
          "-z",
        ]),
      ),
    ];
  }

  const root = path.resolve(rootDir);
  const files = [...new Set(relative)]
    .map((entry) => path.resolve(top, entry))
    .filter(
      (absolute) => absolute === root || absolute.startsWith(root + path.sep),
    )
    .sort();
  return { files, base: resolvedBase };
}
