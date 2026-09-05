import fs from "fs";

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_KEYWORDS } from "../../../src/config/defaults.js";
import {
  boundaryGuardConfigSchema,
  contractSnapshotSchema,
  type BoundaryGuardConfig,
} from "../../../src/config/types.js";
import {
  ConfigExistsError,
  configExists,
  configPath,
  snapshotPath,
  writeConfig,
  writeSnapshot,
} from "../../../src/config/write.js";
import { makeTempProject, type TempProject } from "../../helpers/fixture.js";

const sampleConfig: BoundaryGuardConfig = {
  version: 1,
  frameworkAdapter: "nextjs-app-router",
  providers: [{ id: "prisma", schemaPath: "prisma/schema.prisma" }],
  keywords: { include: [...DEFAULT_KEYWORDS] },
  sensitiveFields: { include: [], exclude: [] },
  sanitizers: ["zod"],
  rules: { "BG-001": true },
};

describe("config writer", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("writes a config that round-trips through the schema", async () => {
    project = makeTempProject();

    const written = await writeConfig(project.dir, sampleConfig, {
      overwrite: false,
    });

    expect(written).toBe(configPath(project.dir));
    expect(configExists(project.dir)).toBe(true);
    const parsed = boundaryGuardConfigSchema.parse(
      JSON.parse(fs.readFileSync(written, "utf8")),
    );
    expect(parsed).toEqual(sampleConfig);
  });

  it("refuses to overwrite an existing config unless told to", async () => {
    project = makeTempProject();
    await writeConfig(project.dir, sampleConfig, { overwrite: false });

    await expect(
      writeConfig(project.dir, sampleConfig, { overwrite: false }),
    ).rejects.toBeInstanceOf(ConfigExistsError);
    await expect(
      writeConfig(project.dir, sampleConfig, { overwrite: true }),
    ).resolves.toBe(configPath(project.dir));
  });

  it("rejects a config that violates the schema before touching disk", async () => {
    project = makeTempProject();
    const invalid = {
      ...sampleConfig,
      version: 2,
    } as unknown as BoundaryGuardConfig;

    await expect(
      writeConfig(project.dir, invalid, { overwrite: false }),
    ).rejects.toThrow();
    expect(configExists(project.dir)).toBe(false);
  });

  it("writes the snapshot, creating .boundary-guard/", async () => {
    project = makeTempProject();
    const snapshot = {
      generatedAt: "2026-09-04T00:00:00.000Z",
      sources: [
        { field: "password_hash", origin: "prisma:User.password_hash" },
      ],
    };

    const written = await writeSnapshot(project.dir, snapshot);

    expect(written).toBe(snapshotPath(project.dir));
    expect(
      contractSnapshotSchema.parse(
        JSON.parse(fs.readFileSync(written, "utf8")),
      ),
    ).toEqual(snapshot);
  });
});
