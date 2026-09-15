import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AGENT_SECTION_END,
  AGENT_SECTION_START,
  agentSectionBody,
  writeAgentSection,
} from "../../../src/init/agent-context.js";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "antra-agent-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("writeAgentSection", () => {
  it("creates AGENTS.md when absent", async () => {
    const status = await writeAgentSection(root, "body text");
    expect(status).toBe("created");
    expect(read("AGENTS.md")).toContain("body text");
  });

  it("wraps the body in markers", async () => {
    await writeAgentSection(root, "body text");
    const text = read("AGENTS.md");
    expect(text).toContain(AGENT_SECTION_START);
    expect(text).toContain(AGENT_SECTION_END);
    expect(text.indexOf(AGENT_SECTION_START)).toBeLessThan(
      text.indexOf("body text"),
    );
  });

  it("is idempotent — running twice leaves one section", async () => {
    await writeAgentSection(root, "body text");
    const status = await writeAgentSection(root, "body text");
    const text = read("AGENTS.md");
    expect(status).toBe("unchanged");
    expect(text.split(AGENT_SECTION_START).length - 1).toBe(1);
  });

  it("replaces the section when the body changes", async () => {
    await writeAgentSection(root, "first body");
    const status = await writeAgentSection(root, "second body");
    const text = read("AGENTS.md");
    expect(status).toBe("updated");
    expect(text).toContain("second body");
    expect(text).not.toContain("first body");
  });

  it("preserves content around the section", async () => {
    fs.writeFileSync(
      path.join(root, "AGENTS.md"),
      `# House rules\n\nBe nice.\n\n${AGENT_SECTION_START}\nold\n${AGENT_SECTION_END}\n\n## After\n\nKeep me.\n`,
    );
    await writeAgentSection(root, "new body");
    const text = read("AGENTS.md");
    expect(text).toContain("Be nice.");
    expect(text).toContain("Keep me.");
    expect(text).not.toContain("old");
  });

  it("appends when the file exists without markers", async () => {
    fs.writeFileSync(
      path.join(root, "AGENTS.md"),
      "# House rules\n\nBe nice.\n",
    );
    const status = await writeAgentSection(root, "body text");
    const text = read("AGENTS.md");
    expect(status).toBe("appended");
    expect(text).toContain("Be nice.");
    expect(text).toContain("body text");
  });
});

describe("agentSectionBody", () => {
  it("names all four rules", () => {
    const body = agentSectionBody();
    for (const rule of ["BG-001", "BG-002", "BG-003", "BG-004"]) {
      expect(body).toContain(rule);
    }
  });

  it("states the verification command", () => {
    expect(agentSectionBody()).toContain("antra scan --fail-on error");
  });
});
