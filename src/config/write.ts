import fs from "fs";
import path from "path";

import {
  boundaryGuardConfigSchema,
  contractSnapshotSchema,
  type BoundaryGuardConfig,
  type ContractSnapshot,
} from "./types.js";

export const CONFIG_FILENAME = "boundary-guard.config.json";
export const SNAPSHOT_DIR = ".boundary-guard";
export const SNAPSHOT_FILENAME = "contract-snapshot.json";

export function configPath(rootDir: string): string {
  return path.join(rootDir, CONFIG_FILENAME);
}

export function snapshotPath(rootDir: string): string {
  return path.join(rootDir, SNAPSHOT_DIR, SNAPSHOT_FILENAME);
}

export function configExists(rootDir: string): boolean {
  return fs.existsSync(configPath(rootDir));
}

export class ConfigExistsError extends Error {
  constructor(filePath: string) {
    super(`${filePath} already exists; pass overwrite: true to replace it`);
    this.name = "ConfigExistsError";
  }
}

/**
 * Writes `boundary-guard.config.json`. Refuses to clobber an existing file
 * unless `overwrite` is explicitly true — the confirmation prompt lives in
 * `init`, this layer only enforces the decision (FR-INIT-7).
 */
export async function writeConfig(
  rootDir: string,
  config: BoundaryGuardConfig,
  options: { overwrite: boolean },
): Promise<string> {
  const target = configPath(rootDir);
  if (!options.overwrite && fs.existsSync(target)) {
    throw new ConfigExistsError(target);
  }
  await writeJson(target, boundaryGuardConfigSchema.parse(config));
  return target;
}

/** Writes `.boundary-guard/contract-snapshot.json`, creating the directory. */
export async function writeSnapshot(
  rootDir: string,
  snapshot: ContractSnapshot,
): Promise<string> {
  const target = snapshotPath(rootDir);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await writeJson(target, contractSnapshotSchema.parse(snapshot));
  return target;
}

async function writeJson(target: string, data: unknown): Promise<void> {
  await fs.promises.writeFile(
    target,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}
