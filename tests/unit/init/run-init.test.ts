import fs from "fs";

import { afterEach, describe, expect, it } from "vitest";

import { boundaryGuardConfigSchema } from "../../../src/config/types.js";
import { configPath, snapshotPath } from "../../../src/config/write.js";
import { frameworkAdapters } from "../../../src/framework/index.js";
import type { CheckboxChoice, Prompter } from "../../../src/init/prompter.js";
import {
  FrameworkNotDetectedError,
  runInit,
} from "../../../src/init/run-init.js";
import { selectableProviders } from "../../../src/schema/providers/index.js";
import {
  makeTempProject,
  NEXT_APP_FILES,
  type TempProject,
} from "../../helpers/fixture.js";

interface Script {
  confirm?: boolean;
  /** Override which ids get chosen; default = whatever was pre-checked. */
  choose?: (choices: readonly CheckboxChoice<string>[]) => string[];
  input?: (message: string, defaultValue: string) => string;
}

interface Seen {
  confirms: string[];
  choices: CheckboxChoice<string>[];
  inputs: { message: string; defaultValue: string }[];
}

function scriptedPrompter(script: Script = {}): {
  prompter: Prompter;
  seen: Seen;
} {
  const seen: Seen = { confirms: [], choices: [], inputs: [] };
  const prompter: Prompter = {
    confirm(message) {
      seen.confirms.push(message);
      return Promise.resolve(script.confirm ?? false);
    },
    checkbox<T>(_message: string, choices: readonly CheckboxChoice<T>[]) {
      const asStrings = choices as readonly CheckboxChoice<string>[];
      seen.choices = [...asStrings];
      const chosen = script.choose
        ? script.choose(asStrings)
        : asStrings
            .filter((choice) => choice.checked)
            .map((choice) => choice.value);
      return Promise.resolve(chosen as unknown as T[]);
    },
    input(message, defaultValue) {
      seen.inputs.push({ message, defaultValue });
      return Promise.resolve(
        script.input ? script.input(message, defaultValue) : defaultValue,
      );
    },
  };
  return { prompter, seen };
}

function run(dir: string, script?: Script) {
  const { prompter, seen } = scriptedPrompter(script);
  return {
    seen,
    result: runInit({
      rootDir: dir,
      prompter,
      adapters: frameworkAdapters,
      providers: selectableProviders,
    }),
  };
}

describe("runInit", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("refuses a project that isn't Next.js App Router", async () => {
    project = makeTempProject({ "package.json": "{}" });

    await expect(run(project.dir).result).rejects.toBeInstanceOf(
      FrameworkNotDetectedError,
    );
    expect(fs.existsSync(configPath(project.dir))).toBe(false);
  });

  it("falls through to zero-schema when nothing is detected and nothing is chosen", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    const { result, seen } = run(project.dir);
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.frameworkAdapter).toBe("nextjs-app-router");
    expect(outcome.config.providers).toEqual([]);
    expect(outcome.snapshot.sources).toEqual([]);
    expect(outcome.skipped).toEqual([]);
    expect(seen.choices.every((choice) => choice.checked === false)).toBe(true);
    expect(seen.inputs).toEqual([]);

    const onDisk = boundaryGuardConfigSchema.parse(
      JSON.parse(fs.readFileSync(configPath(project.dir), "utf8")),
    );
    expect(onDisk.rules["BG-003"]).toBe(true);
    expect(fs.existsSync(snapshotPath(project.dir))).toBe(true);
  });

  it("pre-checks a detected Prisma schema, records its path, and reports extract() as skipped", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "prisma/schema.prisma": "model User { password_hash String }\n",
    });

    const { result, seen } = run(project.dir);
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(
      seen.choices.find((choice) => choice.value === "prisma")?.checked,
    ).toBe(true);
    expect(
      seen.choices.find((choice) => choice.value === "prisma")?.name,
    ).toContain("detected");
    expect(outcome.config.providers).toEqual([
      { id: "prisma", schemaPath: "prisma/schema.prisma" },
    ]);
    expect(outcome.skipped.map((entry) => entry.id)).toEqual(["prisma"]);
    expect(outcome.snapshot.sources).toEqual([]);
  });

  it("nudges when a provider's dependency is present but its file is missing", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "package.json": JSON.stringify({
        dependencies: { next: "^15.0.0", "@supabase/supabase-js": "^2.0.0" },
      }),
    });

    const { result, seen } = run(project.dir);
    await result;

    const supabase = seen.choices.find((choice) => choice.value === "supabase");
    expect(supabase?.checked).toBe(false);
    expect(supabase?.name).toContain("dependency found");
  });

  it("lets the user enable an undetected provider and type its config", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    const { result } = run(project.dir, {
      choose: () => ["openapi"],
      input: (message) =>
        message.includes("OpenAPI")
          ? "https://api.example.com/openapi.json"
          : "",
    });
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.config.providers).toEqual([
      { id: "openapi", spec: "https://api.example.com/openapi.json" },
    ]);
  });

  it("keeps an existing config when the user declines to overwrite", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "boundary-guard.config.json": '{"marker":true}\n',
    });

    const { result, seen } = run(project.dir, { confirm: false });
    const outcome = await result;

    expect(outcome.status).toBe("aborted");
    expect(seen.confirms).toHaveLength(1);
    expect(seen.choices).toEqual([]);
    expect(fs.readFileSync(configPath(project.dir), "utf8")).toBe(
      '{"marker":true}\n',
    );
  });

  it("overwrites an existing config when the user confirms", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "boundary-guard.config.json": '{"marker":true}\n',
    });

    const outcome = await run(project.dir, { confirm: true }).result;

    expect(outcome.status).toBe("completed");
    expect(
      boundaryGuardConfigSchema.safeParse(
        JSON.parse(fs.readFileSync(configPath(project.dir), "utf8")),
      ).success,
    ).toBe(true);
  });
});
