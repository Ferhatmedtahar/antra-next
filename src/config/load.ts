import fs from "fs";

import {
  boundaryGuardConfigSchema,
  contractSnapshotSchema,
  type BoundaryGuardConfig,
  type ContractSnapshot,
} from "./types.js";
import { CONFIG_FILENAME, configPath, snapshotPath } from "./write.js";

export class ConfigNotFoundError extends Error {
  constructor(rootDir: string) {
    super(
      `No ${CONFIG_FILENAME} in ${rootDir} — run \`boundary-guard init\` first.`,
    );
    this.name = "ConfigNotFoundError";
  }
}

/** Configs written before the `sensitiveFields` rename used `fields`. */
function upgradeLegacyKeys(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if ("fields" in record && !("sensitiveFields" in record)) {
    const { fields, ...rest } = record;
    return { ...rest, sensitiveFields: fields };
  }
  return raw;
}

/** Reads + validates the config. Throws ConfigNotFoundError when absent. */
export async function loadConfig(
  rootDir: string,
): Promise<BoundaryGuardConfig> {
  const target = configPath(rootDir);
  if (!fs.existsSync(target)) throw new ConfigNotFoundError(rootDir);
  const raw: unknown = JSON.parse(await fs.promises.readFile(target, "utf8"));
  return boundaryGuardConfigSchema.parse(upgradeLegacyKeys(raw));
}

/** Like loadConfig, but null when the project was never initialized. */
export async function loadConfigIfPresent(
  rootDir: string,
): Promise<BoundaryGuardConfig | null> {
  return fs.existsSync(configPath(rootDir)) ? loadConfig(rootDir) : null;
}

/** Reads + validates the snapshot; null when it hasn't been written yet. */
export async function loadSnapshot(
  rootDir: string,
): Promise<ContractSnapshot | null> {
  const target = snapshotPath(rootDir);
  if (!fs.existsSync(target)) return null;
  const raw: unknown = JSON.parse(await fs.promises.readFile(target, "utf8"));
  return contractSnapshotSchema.parse(raw);
}
