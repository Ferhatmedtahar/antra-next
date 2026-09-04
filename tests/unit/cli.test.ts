import { describe, expect, it } from "vitest";

import { program } from "../../src/cli/index.js";

describe("cli integration layer", () => {
  it("registers every command from the CLI surface spec", () => {
    const names = program.commands.map((command) => command.name()).sort();
    expect(names).toEqual(
      [
        "baseline",
        "doctor",
        "fix",
        "init",
        "query",
        "scan",
        "studio",
        "sync",
        "trace",
        "watch",
      ].sort(),
    );
  });

  it("exposes the documented flags on scan", () => {
    const scan = program.commands.find((command) => command.name() === "scan");
    const flags = scan?.options.map((option) => option.long);
    expect(flags).toEqual(
      expect.arrayContaining([
        "--strict",
        "--diff",
        "--staged",
        "--fail-on-violation",
        "--format",
        "--rule",
      ]),
    );
  });
});
