import {
  classifySources,
  sensitivityFromConfig,
} from "../classification/classify.js";
import { extractSources, type SkippedProvider } from "../schema/extract.js";
import type { TaintSource } from "../schema/types.js";
import { loadConfig } from "./load.js";
import type { AntraConfig, ContractSnapshot } from "./types.js";
import { writeSnapshot } from "./write.js";

export interface SyncResult {
  config: AntraConfig;
  snapshot: ContractSnapshot;
  snapshotPath: string;
  skipped: SkippedProvider[];
  /** The keyword/pin classification of the fresh snapshot — for review, not persisted. */
  sensitive: TaintSource[];
}

/**
 * `sync`: re-run every configured provider and rewrite the snapshot. The
 * config (keywords, pins, rule toggles) is never touched.
 */
export async function runSync(rootDir: string): Promise<SyncResult> {
  const config = await loadConfig(rootDir);
  const { sources, skipped } = await extractSources(rootDir, config.providers);
  const snapshot: ContractSnapshot = {
    generatedAt: new Date().toISOString(),
    sources,
  };
  const snapshotPath = await writeSnapshot(rootDir, snapshot);
  return {
    config,
    snapshot,
    snapshotPath,
    skipped,
    sensitive: classifySources(sources, sensitivityFromConfig(config)),
  };
}
