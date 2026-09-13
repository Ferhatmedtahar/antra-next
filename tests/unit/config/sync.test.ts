import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_KEYWORDS } from "../../../src/config/defaults.js";
import {
  ConfigNotFoundError,
  loadConfig,
  loadConfigIfPresent,
  loadSnapshot,
} from "../../../src/config/load.js";
import { runSync } from "../../../src/config/sync.js";
import type { AntraConfig } from "../../../src/config/types.js";
import { writeConfig } from "../../../src/config/write.js";
import {
  makeTempProject,
  NEXT_APP_FILES,
  type TempProject,
} from "../../helpers/fixture.js";

const configFor = (providers: AntraConfig["providers"]): AntraConfig => ({
  version: 1,
  frameworkAdapter: "nextjs-app-router",
  providers,
  keywords: { include: [...DEFAULT_KEYWORDS] },
  sensitiveFields: { include: [], exclude: [] },
  sanitizers: ["zod"],
  rules: { "BG-001": true },
});

describe("config loading", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("throws ConfigNotFoundError / returns null when never initialized", async () => {
    project = makeTempProject(NEXT_APP_FILES);

    await expect(loadConfig(project.dir)).rejects.toBeInstanceOf(
      ConfigNotFoundError,
    );
    await expect(loadConfigIfPresent(project.dir)).resolves.toBeNull();
    await expect(loadSnapshot(project.dir)).resolves.toBeNull();
  });

  it("upgrades the legacy `fields` key to `sensitiveFields`", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "antra.config.json": JSON.stringify({
        ...configFor([]),
        sensitiveFields: undefined,
        fields: { include: ["iban"], exclude: [] },
      }),
    });

    const config = await loadConfig(project.dir);

    expect(config.sensitiveFields).toEqual({ include: ["iban"], exclude: [] });
    expect("fields" in config).toBe(false);
  });

  it("rejects a config that fails the schema", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "antra.config.json": '{"version": 2}\n',
    });

    await expect(loadConfig(project.dir)).rejects.toThrow();
  });
});

describe("runSync", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("re-extracts every configured provider and rewrites the snapshot only", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "prisma/schema.prisma":
        "model User { id String @id\n password_hash String }\n",
    });
    await writeConfig(
      project.dir,
      configFor([{ id: "prisma", schemaPath: "prisma/schema.prisma" }]),
      { overwrite: false },
    );

    const result = await runSync(project.dir);

    expect(result.skipped).toEqual([]);
    expect(result.snapshot.sources.map((s) => s.origin)).toEqual([
      "prisma:User.id",
      "prisma:User.password_hash",
    ]);
    expect(result.sensitive.map((s) => s.field)).toEqual(["password_hash"]);
    await expect(loadSnapshot(project.dir)).resolves.toEqual(result.snapshot);
    await expect(loadConfig(project.dir)).resolves.toEqual(result.config);
  });

  it("fails loudly when a configured provider's file is gone", async () => {
    project = makeTempProject(NEXT_APP_FILES);
    await writeConfig(
      project.dir,
      configFor([{ id: "supabase", typesPath: "types/database.types.ts" }]),
      { overwrite: false },
    );

    await expect(runSync(project.dir)).rejects.toThrow(
      /^supabase: .*not found/,
    );
  });
});
