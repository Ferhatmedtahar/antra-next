import { describe, expect, it } from "vitest";

import { VERSION } from "../../src/index.js";

describe("smoke", () => {
  it("loads the package entrypoint", () => {
    expect(VERSION).toBe("0.1.0");
  });
});
