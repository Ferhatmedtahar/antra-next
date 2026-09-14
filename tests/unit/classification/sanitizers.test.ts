import { describe, expect, it } from "vitest";

import { createSanitizerMatcher } from "../../../src/classification/sanitizers.js";

describe("createSanitizerMatcher", () => {
  const zod = createSanitizerMatcher(["zod"]);

  it("recognises schema parse calls", () => {
    expect(zod("profileSchema.parse")).toBe(true);
    expect(zod("schemas.user.safeParseAsync")).toBe(true);
  });

  it("never mistakes built-in or utility parsers for validation", () => {
    for (const callee of [
      "JSON.parse",
      "Date.parse",
      "URL.parse",
      "Number.parseInt",
      "path.parse",
      "querystring.parse",
      "qs.parse",
      "cookie.parse",
      "YAML.parse",
      "Papa.parse",
    ]) {
      expect(zod(callee), callee).toBe(false);
    }
  });

  it("treats a configured custom name as a function or method name", () => {
    const custom = createSanitizerMatcher(["sanitizeUser"]);
    expect(custom("sanitizeUser")).toBe(true);
    expect(custom("lib.sanitizeUser")).toBe(true);
    expect(custom("sanitizeUserName")).toBe(false);
  });
});
