import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findEnvVar,
  parseEnvFile,
  readProjectEnv,
  redact,
} from "../../../src/utils/env.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

describe("env files", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("parses assignments, quotes, exports and comments", () => {
    expect(
      parseEnvFile(
        [
          "# a comment",
          "",
          "PLAIN=value",
          "SPACED = spaced ",
          'DOUBLE="with spaces"',
          "SINGLE='raw \\n stays'",
          "export EXPORTED=yes",
          "TRAILING=value # not part of it",
          'QUOTED_HASH="value # kept"',
          'MULTI="line\\nbreak"',
          "not a line",
          "EMPTY=",
        ].join("\n"),
      ),
    ).toEqual({
      PLAIN: "value",
      SPACED: "spaced",
      DOUBLE: "with spaces",
      SINGLE: "raw \\n stays",
      EXPORTED: "yes",
      TRAILING: "value",
      QUOTED_HASH: "value # kept",
      MULTI: "line\nbreak",
      EMPTY: "",
    });
  });

  it("layers .env under .env.local under the real environment", () => {
    project = makeTempProject({
      ".env": "SHARED=from-env\nONLY_BASE=base\nSUPABASE_URL=https://base\n",
      ".env.local": "SHARED=from-local\nSECRET=local-secret\n",
    });

    const values = readProjectEnv(project.dir, { SHARED: "from-process" });

    expect(values.SHARED).toBe("from-process");
    expect(values.ONLY_BASE).toBe("base");
    expect(values.SECRET).toBe("local-secret");
    expect(values.SUPABASE_URL).toBe("https://base");
  });

  it("survives an unreadable env file", () => {
    project = makeTempProject({ ".env": "OK=1\n" });
    fs.mkdirSync(path.join(project.dir, ".env.local"));

    expect(readProjectEnv(project.dir, {}).OK).toBe("1");
  });

  it("picks the first candidate that has a value, and redacts secrets", () => {
    const env = { A: "", B: "  ", C: "value" };
    expect(findEnvVar(env, ["A", "B", "C"])).toEqual({
      name: "C",
      value: "value",
    });
    expect(findEnvVar(env, ["A", "B"])).toBeNull();

    expect(
      redact("supersecretkey", "failed with supersecretkey in header"),
    ).toBe("failed with [redacted] in header");
    // Too short to be a key; blanking it would mangle unrelated text.
    expect(redact("abc", "abc appears here")).toBe("abc appears here");
  });
});
