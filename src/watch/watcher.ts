import fs from "fs";
import path from "path";

import { BASELINE_FILENAME } from "../baseline/baseline.js";
import {
  CONFIG_FILENAME,
  SNAPSHOT_DIR,
  SNAPSHOT_FILENAME,
} from "../config/write.js";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
]);

/** Files whose change means "everything may differ" — always a full rescan. */
export function isProjectSettingsPath(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  return (
    normalized === CONFIG_FILENAME ||
    normalized === `${SNAPSHOT_DIR}/${SNAPSHOT_FILENAME}` ||
    normalized === `${SNAPSHOT_DIR}/${BASELINE_FILENAME}`
  );
}

/** Source files the scanner reads, minus build output and the tool's own state. */
export function isWatchedPath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/);
  if (segments.some((segment) => IGNORED_SEGMENTS.has(segment))) return false;
  if (isProjectSettingsPath(relativePath)) return true;
  if (segments[0] === SNAPSHOT_DIR) return false;
  const name = segments[segments.length - 1] ?? "";
  if (name.endsWith(".d.ts")) return false;
  return SOURCE_EXTENSIONS.has(path.extname(name));
}

export interface Watcher {
  close(): void;
  /** Directories currently watched — for diagnostics and tests. */
  readonly size: number;
}

/**
 * One non-recursive fs.watch per directory, skipping node_modules and
 * build output entirely. Node's own `recursive: true` walks everything on
 * Linux — on a real app that means tens of thousands of node_modules
 * directories, a setup that takes longer than the first save, and inotify
 * limits. New directories are picked up as they appear; saves are debounced
 * so a formatter touching several files produces one batch.
 */
export function startWatcher(
  rootDir: string,
  onChange: (paths: string[]) => void,
  options: { debounceMs?: number } = {},
): Watcher {
  const debounceMs = options.debounceMs ?? 300;
  const pending = new Set<string>();
  const watchers = new Map<string, fs.FSWatcher>();
  let timer: NodeJS.Timeout | null = null;

  const flush = () => {
    timer = null;
    const batch = [...pending].sort();
    pending.clear();
    if (batch.length > 0) onChange(batch);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const watchTree = (dir: string) => {
    if (watchers.has(dir)) return;
    let watcher: fs.FSWatcher;
    try {
      watcher = fs.watch(dir, (event, filename) => {
        if (!filename) return;
        const full = path.join(dir, filename.toString());
        const relative = path.relative(rootDir, full);
        if (event === "rename") {
          // A new directory: start watching it (and whatever's already inside).
          try {
            if (fs.statSync(full).isDirectory()) {
              if (!IGNORED_SEGMENTS.has(path.basename(full))) watchTree(full);
              return;
            }
          } catch {
            // Removed — a directory watcher errors out on its own below.
          }
        }
        if (!isWatchedPath(relative)) return;
        pending.add(full);
        schedule();
      });
    } catch {
      return; // Vanished between readdir and watch, or unreadable.
    }
    watcher.on("error", () => {
      watcher.close();
      watchers.delete(dir);
    });
    watchers.set(dir, watcher);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !IGNORED_SEGMENTS.has(entry.name)) {
        watchTree(path.join(dir, entry.name));
      }
    }
  };
  watchTree(rootDir);

  return {
    close() {
      if (timer) clearTimeout(timer);
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    },
    get size() {
      return watchers.size;
    },
  };
}
