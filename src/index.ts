import { existsSync, readFileSync } from "node:fs";

/**
 * Read from `package.json` instead of written here. The two drifted once
 * already — this file said `0.1.0` while the package said `0.2.0` — and both
 * the Studio footer and the SARIF `tool.driver.version` show it to users, so a
 * stale copy is a wrong answer rather than a cosmetic one.
 *
 * The nearest `package.json` *above* this module, rather than a fixed `../`:
 * tsup bundles this file into both `dist/index.js` and `dist/cli/index.js`, and
 * `tsx` runs it from `src/`, so the package root sits one directory up from some
 * of those and two from others — `../package.json` from `dist/cli/` is
 * `dist/package.json`, which the build never writes. npm always ships
 * `package.json` regardless of the `files` field, so it is always up there to
 * find.
 */
function readVersion(): string {
  let dir = new URL(".", import.meta.url);
  for (let up = 0; up < 4; up += 1) {
    const manifest = new URL("package.json", dir);
    if (existsSync(manifest)) {
      const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
        version: string;
      };
      return pkg.version;
    }
    dir = new URL("../", dir);
  }
  throw new Error("antra: no package.json found above the entrypoint");
}

export const VERSION = readVersion();
