import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { VERSION } from "../../src/index.js";

// Against the manifest rather than a literal: a number written here is the same
// drift the entrypoint was changed to stop, and it is what the published
// package, the Studio footer and the SARIF report all have to agree with.
const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("smoke", () => {
  it("loads the package entrypoint", () => {
    expect(VERSION).toBe(pkg.version);
  });
});
