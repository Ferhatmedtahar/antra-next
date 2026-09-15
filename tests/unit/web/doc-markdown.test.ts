import { describe, expect, it } from "vitest";

import { toMarkdown } from "../../../apps/web/lib/doc-markdown.js";

describe("toMarkdown", () => {
  it("leads with the title as an h1", () => {
    const out = toMarkdown({
      slug: "commands/scan",
      meta: { title: "antra scan", description: "Scan a project.", order: 1 },
      content: "Body text.",
    });
    expect(out.startsWith("# antra scan")).toBe(true);
  });

  it("includes the description when present", () => {
    const out = toMarkdown({
      slug: "a",
      meta: { title: "A", description: "Short summary.", order: 1 },
      content: "Body.",
    });
    expect(out).toContain("Short summary.");
  });

  it("omits the description when absent", () => {
    const out = toMarkdown({
      slug: "a",
      meta: { title: "A", order: 1 },
      content: "Body.",
    });
    expect(out.split("\n").filter(Boolean)[1]).toBe("Body.");
  });

  it("preserves the body verbatim", () => {
    const body = "## Heading\n\n```ts\nconst a = 1;\n```\n";
    const out = toMarkdown({
      slug: "a",
      meta: { title: "A", order: 1 },
      content: body,
    });
    expect(out).toContain("const a = 1;");
  });

  it("ends with exactly one trailing newline", () => {
    const out = toMarkdown({
      slug: "a",
      meta: { title: "A", order: 1 },
      content: "Body.\n\n\n",
    });
    expect(out.endsWith("Body.\n")).toBe(true);
  });
});
