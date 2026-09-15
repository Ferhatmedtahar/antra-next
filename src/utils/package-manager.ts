/**
 * Browser-safe: no filesystem imports here. The prompt module runs in the
 * Studio bundle and derives its verification command from these values, and
 * the browser bundle must not pull in `node:fs`.
 */

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** The prefix that runs a locally installed binary under `pm`. */
export function runPrefix(pm: PackageManager): string {
  switch (pm) {
    case "pnpm":
      return "pnpm exec";
    case "yarn":
      return "yarn";
    case "bun":
      return "bunx";
    default:
      return "npx";
  }
}
