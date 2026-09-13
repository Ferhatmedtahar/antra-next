import fs from "fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { antraConfigSchema } from "../../../src/config/types.js";
import { configPath, snapshotPath } from "../../../src/config/write.js";
import { frameworkAdapters } from "../../../src/framework/index.js";
import type { CheckboxChoice, Prompter } from "../../../src/init/prompter.js";
import { FrameworkNotDetectedError } from "../../../src/framework/detect.js";
import type { CodegenRunner } from "../../../src/init/run-init.js";
import { runInit } from "../../../src/init/run-init.js";
import { selectableProviders } from "../../../src/schema/providers/index.js";
import {
  KEY_ENV_CANDIDATES,
  URL_ENV_CANDIDATES,
} from "../../../src/schema/providers/supabase.js";
import {
  makeTempProject,
  NEXT_APP_FILES,
  type TempProject,
} from "../../helpers/fixture.js";

interface Script {
  /** A fixed answer, or one decided per message when a flow asks twice. */
  confirm?: boolean | ((message: string) => boolean);
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
      return Promise.resolve(
        typeof script.confirm === "function"
          ? script.confirm(message)
          : (script.confirm ?? false),
      );
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

function run(dir: string, script?: Script, exec?: CodegenRunner) {
  const { prompter, seen } = scriptedPrompter(script);
  return {
    seen,
    result: runInit({
      rootDir: dir,
      prompter,
      adapters: frameworkAdapters,
      providers: selectableProviders,
      ...(exec ? { exec } : {}),
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

    const { result, seen } = run(project.dir, { confirm: true });
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.frameworkAdapter).toBe("nextjs-app-router");
    expect(seen.confirms).toEqual([
      "Nothing selected. Continue with zero-schema heuristics only?",
    ]);
    expect(outcome.config.providers).toEqual([]);
    expect(outcome.config.sensitiveFields).toEqual({
      include: [],
      exclude: [],
    });
    expect(outcome.snapshot.sources).toEqual([]);
    expect(outcome.skipped).toEqual([]);
    expect(seen.choices.every((choice) => choice.checked === false)).toBe(true);
    expect(seen.inputs).toEqual([]);

    const onDisk = antraConfigSchema.parse(
      JSON.parse(fs.readFileSync(configPath(project.dir), "utf8")),
    );
    expect(onDisk.rules["BG-003"]).toBe(true);
    expect(fs.existsSync(snapshotPath(project.dir))).toBe(true);
  });

  it("pre-checks a detected Prisma schema, records its path, and extracts its fields", async () => {
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
    expect(outcome.skipped).toEqual([]);
    expect(outcome.snapshot.sources).toEqual([
      { field: "password_hash", origin: "prisma:User.password_hash" },
    ]);
    // The config file shows the flagged list, seeded from the keywords.
    expect(outcome.config.sensitiveFields).toEqual({
      include: ["prisma:User.password_hash"],
      exclude: [],
    });
  });

  it("nudges when a provider's dependency is present but its file is missing", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "package.json": JSON.stringify({
        dependencies: { next: "^15.0.0", "@supabase/supabase-js": "^2.0.0" },
      }),
    });

    const { result, seen } = run(project.dir, { confirm: true });
    await result;

    const supabase = seen.choices.find((choice) => choice.value === "supabase");
    expect(supabase?.checked).toBe(false);
    expect(supabase?.name).toContain("dependency found");
  });

  it("re-prompts on an empty submit until something is chosen or the user explicitly continues", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "prisma/schema.prisma": "model User { id String @id }\n",
    });
    let attempts = 0;

    const { result, seen } = run(project.dir, {
      confirm: false,
      choose: () => (attempts++ === 0 ? [] : ["prisma"]),
    });
    const outcome = await result;

    expect(attempts).toBe(2);
    expect(seen.confirms).toEqual([
      "Nothing selected. Continue with zero-schema heuristics only?",
    ]);
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.config.providers.map((provider) => provider.id)).toEqual([
      "prisma",
    ]);
  });

  it("lets the user enable an undetected provider, type its config, and extracts from it", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      // Non-conventional name on purpose: must NOT be auto-detected.
      "specs/backend.json": JSON.stringify({
        openapi: "3.0.0",
        components: {
          schemas: { User: { properties: { api_key: { type: "string" } } } },
        },
      }),
    });

    const { result, seen } = run(project.dir, {
      choose: () => ["openapi"],
      input: (message) =>
        message.includes("OpenAPI") ? "specs/backend.json" : "",
    });
    const outcome = await result;

    expect(
      seen.choices.find((choice) => choice.value === "openapi")?.checked,
    ).toBe(false);
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.config.providers).toEqual([
      { id: "openapi", spec: "specs/backend.json" },
    ]);
    expect(outcome.snapshot.sources).toEqual([
      { field: "api_key", origin: "openapi:User.api_key" },
    ]);
  });

  it("keeps an existing config when the user declines to overwrite", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "antra.config.json": '{"marker":true}\n',
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
      "antra.config.json": '{"marker":true}\n',
    });

    const outcome = await run(project.dir, { confirm: true }).result;

    expect(outcome.status).toBe("completed");
    expect(
      antraConfigSchema.safeParse(
        JSON.parse(fs.readFileSync(configPath(project.dir), "utf8")),
      ).success,
    ).toBe(true);
  });

  it("offers to generate a missing Prisma schema and uses the CLI's output when accepted", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    const exec: CodegenRunner = (command, args, options) => {
      expect(command).toBe("npx");
      expect(args).toEqual(["prisma", "db", "pull"]);
      fs.mkdirSync(`${options.cwd}/prisma`, { recursive: true });
      fs.writeFileSync(
        `${options.cwd}/prisma/schema.prisma`,
        "model User { password_hash String }\n",
      );
      return Promise.resolve({ stdout: "" });
    };

    const { result, seen } = run(
      project.dir,
      { confirm: true, choose: () => ["prisma"] },
      exec,
    );
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(seen.confirms).toEqual([
      "No Prisma (schema.prisma) schema file was found. Generate one now using its CLI?",
    ]);
    expect(outcome.config.providers).toEqual([
      { id: "prisma", schemaPath: "prisma/schema.prisma" },
    ]);
    expect(outcome.snapshot.sources).toEqual([
      { field: "password_hash", origin: "prisma:User.password_hash" },
    ]);
    expect(outcome.notes).toEqual([
      "Prisma (schema.prisma): generated prisma/schema.prisma.",
    ]);
  });

  it("declines the generate offer, drops the provider once the user confirms, and never stores a refusal word as a path", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    const { result, seen } = run(project.dir, {
      // Decline the generate offer, accept the fallback. The two are asked
      // in sequence, so the script has to answer them differently.
      confirm: (message) => message.includes("no usable source yet"),
      choose: () => ["prisma"],
      input: () => "n",
    });
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(seen.confirms).toEqual([
      "No Prisma (schema.prisma) schema file was found. Generate one now using its CLI?",
      "Prisma (schema.prisma) has no usable source yet. Continue with zero-schema heuristics only?",
    ]);
    // The generate offer was declined, so the conventional path is no longer
    // re-suggested as a default: it would only invite an answer extract()
    // has to reject. Enter has to mean "skip this one".
    expect(seen.inputs).toEqual([
      {
        message: "Prisma (schema.prisma): Path to your Prisma schema",
        defaultValue: "",
      },
    ]);
    // "n" must never land in the config as a literal path.
    expect(outcome.config.providers).toEqual([]);
    expect(outcome.notes.join("\n")).toContain("npx prisma db pull");
    expect(outcome.notes.join("\n")).toContain("not configured for this run");
  });
});

const OPENAPI_DOC = {
  swagger: "2.0",
  definitions: {
    users: {
      properties: { id: { type: "string" }, password_hash: { type: "string" } },
    },
  },
};

/**
 * The API path reaches the network, so fetch is stubbed at the global
 * extractSupabaseApi reads by default. Returns the URLs it was called with.
 */
function stubOpenApi(): { urls: string[] } {
  const urls: string[] = [];
  vi.stubGlobal("fetch", (url: string) => {
    urls.push(url);
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(JSON.stringify(OPENAPI_DOC)),
    });
  });
  return { urls };
}

/**
 * The flow this file exists to protect: no generated types file, no
 * recognised credentials, and a user who just holds Enter. That used to
 * dead-end — a bare path prompt whose empty answer silently dropped the
 * provider, leaving a scan with nothing to check.
 */
describe("runInit with Supabase and no schema file", () => {
  let project: TempProject | undefined;
  const conventional = [...URL_ENV_CANDIDATES, ...KEY_ENV_CANDIDATES];
  let ambient: (string | undefined)[] = [];

  beforeEach(() => {
    // A dev machine that exports real Supabase credentials would steer
    // configFields down its "credentials detected" branch. These tests are
    // about the branch where neither a types file nor credentials exist.
    ambient = conventional.map((name) => process.env[name]);
    for (const name of conventional) delete process.env[name];
  });

  afterEach(() => {
    conventional.forEach((name, index) => {
      const value = ambient[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
    project?.cleanup();
    project = undefined;
    vi.unstubAllGlobals();
  });

  it("offers the project's API when no types file exists, and reads the schema from it", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      ".env.local":
        "ANTRA_TEST_SUPABASE_URL=https://abc.supabase.co\nANTRA_TEST_SUPABASE_KEY=service-key\n",
    });
    const { urls } = stubOpenApi();

    const { result, seen } = run(project.dir, {
      // Decline the generate offer, so the API path is what's left.
      confirm: false,
      choose: () => ["supabase"],
      input: (message) => {
        if (message.includes("types file")) return "";
        if (message.includes("project URL")) return "ANTRA_TEST_SUPABASE_URL";
        if (message.includes("API key")) return "ANTRA_TEST_SUPABASE_KEY";
        return "";
      },
    });
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(seen.confirms).toEqual([
      "No Supabase (generated types, or your project's API) schema file was found. Generate one now using its CLI?",
    ]);
    expect(outcome.config.providers).toEqual([
      {
        id: "supabase",
        urlEnv: "ANTRA_TEST_SUPABASE_URL",
        keyEnv: "ANTRA_TEST_SUPABASE_KEY",
      },
    ]);
    expect(urls).toEqual(["https://abc.supabase.co/rest/v1/"]);
    expect(outcome.snapshot.sources).toEqual([
      { field: "id", origin: "supabase:public.users.id" },
      { field: "password_hash", origin: "supabase:public.users.password_hash" },
    ]);
  });

  it("asks before falling back to zero-schema when nothing usable was given", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    const { result, seen } = run(project.dir, {
      confirm: (message) => message.includes("no usable source yet"),
      choose: () => ["supabase"],
      input: () => "",
    });
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(seen.confirms).toContain(
      "Supabase (generated types, or your project's API) has no usable source yet. Continue with zero-schema heuristics only?",
    );
    expect(outcome.config.providers).toEqual([]);
    expect(outcome.notes.join("\n")).toContain("not configured for this run");
    // The generate offer was declined, so the missing types path is offered
    // as skippable; the credential fields still carry the conventional names,
    // so a project that has them can just press Enter through.
    expect(seen.inputs).toHaveLength(4);
    expect(seen.inputs[0]?.message).toContain("types file");
    expect(seen.inputs[0]?.defaultValue).toBe("");
    expect(seen.inputs.slice(1).map((entry) => entry.defaultValue)).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "public",
    ]);
  });

  it("re-asks the provider's fields when the user declines to fall back to zero-schema", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      ".env.local":
        "ANTRA_TEST_SUPABASE_URL=https://abc.supabase.co\nANTRA_TEST_SUPABASE_KEY=service-key\n",
    });
    stubOpenApi();
    let typesFileAsks = 0;
    let fallbackOffers = 0;

    const { result } = run(project.dir, {
      confirm: (message) =>
        message.includes("no usable source yet") ? ++fallbackOffers > 1 : false,
      choose: () => ["supabase"],
      input: (message) => {
        if (message.includes("types file")) {
          typesFileAsks++;
          return "";
        }
        // The first pass answers nothing, which is what forces the fallback
        // question; the second supplies what the provider actually needs.
        if (typesFileAsks === 1) return "";
        if (message.includes("project URL")) return "ANTRA_TEST_SUPABASE_URL";
        if (message.includes("API key")) return "ANTRA_TEST_SUPABASE_KEY";
        return "";
      },
    });
    const outcome = await result;

    expect(typesFileAsks).toBe(2);
    expect(fallbackOffers).toBe(1);
    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.config.providers).toEqual([
      {
        id: "supabase",
        urlEnv: "ANTRA_TEST_SUPABASE_URL",
        keyEnv: "ANTRA_TEST_SUPABASE_KEY",
      },
    ]);
  });

  it("rejects a types path that isn't there instead of writing it and failing later", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    const { result } = run(project.dir, {
      confirm: (message) => message.includes("no usable source yet"),
      choose: () => ["supabase"],
      // A real-looking path that no file backs. Writing this into the config
      // is what used to abort init with "types file not found" from extract().
      input: (message) =>
        message.includes("types file") ? "types/database.types.ts" : "",
    });
    const outcome = await result;

    expect(outcome.status).toBe("completed");
    if (outcome.status !== "completed") return;
    expect(outcome.config.providers).toEqual([]);
    expect(outcome.notes.join("\n")).toContain("not configured for this run");
  });
});
