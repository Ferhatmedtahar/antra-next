import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectPackageManager, hopFrame } from "../../../src/studio/server.js";

let root: string;

const emptyCache = () => new Map<string, string[] | null>();

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "antra-hops-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("hopFrame", () => {
  it("returns a frame centred on the step's line", () => {
    fs.writeFileSync(
      path.join(root, "a.ts"),
      ["one", "two", "three", "four", "five", "six"].join("\n"),
    );
    const frame = hopFrame(root, emptyCache(), {
      text: "x",
      file: "a.ts",
      line: 4,
    });
    expect(frame).not.toBeNull();
    expect(frame?.startLine).toBe(2);
    expect(frame?.lines).toContain("four");
  });

  it("returns null when the step has no file", () => {
    expect(hopFrame(root, emptyCache(), { text: "x" })).toBeNull();
  });

  it("returns null when the step has no line", () => {
    expect(
      hopFrame(root, emptyCache(), { text: "x", file: "a.ts" }),
    ).toBeNull();
  });

  it("returns null when the file cannot be read", () => {
    expect(
      hopFrame(root, emptyCache(), { text: "x", file: "missing.ts", line: 2 }),
    ).toBeNull();
  });

  it("reuses the shared cache across hops in one file", () => {
    fs.writeFileSync(
      path.join(root, "a.ts"),
      ["one", "two", "three"].join("\n"),
    );
    const cache = emptyCache();
    hopFrame(root, cache, { text: "x", file: "a.ts", line: 1 });
    expect(cache.size).toBe(1);
    hopFrame(root, cache, { text: "y", file: "a.ts", line: 3 });
    expect(cache.size).toBe(1);
  });
});

describe("detectPackageManager", () => {
  it("defaults to npm when no lockfile is present", () => {
    expect(detectPackageManager(root)).toBe("npm");
  });

  it("detects pnpm", () => {
    fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(root)).toBe("pnpm");
  });

  it("detects yarn", () => {
    fs.writeFileSync(path.join(root, "yarn.lock"), "");
    expect(detectPackageManager(root)).toBe("yarn");
  });

  it("detects bun", () => {
    fs.writeFileSync(path.join(root, "bun.lockb"), "");
    expect(detectPackageManager(root)).toBe("bun");
  });

  it("prefers pnpm when several lockfiles exist", () => {
    fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "");
    fs.writeFileSync(path.join(root, "yarn.lock"), "");
    expect(detectPackageManager(root)).toBe("pnpm");
  });
});
