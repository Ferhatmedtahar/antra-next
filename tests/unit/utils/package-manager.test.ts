import { describe, expect, it } from "vitest";

import { runPrefix } from "../../../src/utils/package-manager.js";

describe("runPrefix", () => {
  it("uses npx for npm", () => {
    expect(runPrefix("npm")).toBe("npx");
  });

  it("uses exec for pnpm", () => {
    expect(runPrefix("pnpm")).toBe("pnpm exec");
  });

  it("uses the bare binary for yarn", () => {
    expect(runPrefix("yarn")).toBe("yarn");
  });

  it("uses bunx for bun", () => {
    expect(runPrefix("bun")).toBe("bunx");
  });
});
