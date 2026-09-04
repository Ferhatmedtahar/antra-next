import {
  DEFAULT_KEYWORDS,
  DEFAULT_RULES,
  DEFAULT_SANITIZERS,
} from "../config/defaults.js";
import type {
  BoundaryGuardConfig,
  ContractSnapshot,
  ProviderConfig,
} from "../config/types.js";
import {
  CONFIG_FILENAME,
  configExists,
  writeConfig,
  writeSnapshot,
} from "../config/write.js";
import { requireFramework } from "../framework/detect.js";
import type { FrameworkAdapter } from "../framework/types.js";
import { NotImplementedError } from "../schema/errors.js";
import type { SchemaProvider, TaintSource } from "../schema/types.js";
import { hasDependency, readPackageJson } from "../utils/package-json.js";
import type { Prompter } from "./prompter.js";

export interface InitOptions {
  rootDir: string;
  prompter: Prompter;
  adapters: readonly FrameworkAdapter[];
  providers: readonly SchemaProvider[];
}

export interface ProviderDetection {
  provider: SchemaProvider;
  /** detect() found the provider's schema/types file. */
  detected: boolean;
  /** package.json lists one of provider.dependencyPackages. */
  dependencyFound: boolean;
}

export interface SkippedProvider {
  id: string;
  reason: string;
}

export type InitResult =
  | { status: "aborted"; reason: string }
  | {
      status: "completed";
      frameworkAdapter: string;
      config: BoundaryGuardConfig;
      snapshot: ContractSnapshot;
      configPath: string;
      snapshotPath: string;
      detections: ProviderDetection[];
      skipped: SkippedProvider[];
    };

/**
 * The whole `init` flow, with every human interaction going through
 * `prompter`. Sequencing lives here — `cli/commands/init.ts` only builds
 * the real prompter and prints the result.
 */
export async function runInit(options: InitOptions): Promise<InitResult> {
  const { rootDir, prompter, adapters, providers } = options;

  const adapter = await requireFramework(rootDir, adapters);

  if (configExists(rootDir)) {
    const overwrite = await prompter.confirm(
      `${CONFIG_FILENAME} already exists here. Overwrite it?`,
      false,
    );
    if (!overwrite) {
      return { status: "aborted", reason: "existing config kept" };
    }
  }

  const detections = await detectProviders(providers, rootDir);

  const chosenIds = await chooseProviders(detections, prompter);
  const enabled = detections
    .filter((detection) => chosenIds.includes(detection.provider.id))
    .map((detection) => detection.provider);

  const providerConfigs = await collectProviderConfigs(
    enabled,
    rootDir,
    prompter,
  );

  const { sources, skipped } = await extractAll(
    enabled,
    providerConfigs,
    rootDir,
  );

  const config: BoundaryGuardConfig = {
    version: 1,
    frameworkAdapter: adapter.id,
    providers: providerConfigs.map(
      ({ config: providerConfig }) => providerConfig,
    ),
    keywords: { include: [...DEFAULT_KEYWORDS], exclude: [] },
    sanitizers: [...DEFAULT_SANITIZERS],
    rules: { ...DEFAULT_RULES },
  };
  const snapshot: ContractSnapshot = {
    generatedAt: new Date().toISOString(),
    sources,
  };

  const configPath = await writeConfig(rootDir, config, { overwrite: true });
  const snapshotPath = await writeSnapshot(rootDir, snapshot);

  return {
    status: "completed",
    frameworkAdapter: adapter.id,
    config,
    snapshot,
    configPath,
    snapshotPath,
    detections,
    skipped,
  };
}

async function detectProviders(
  providers: readonly SchemaProvider[],
  rootDir: string,
): Promise<ProviderDetection[]> {
  const packageJson = await readPackageJson(rootDir);
  const detections: ProviderDetection[] = [];
  for (const provider of providers) {
    detections.push({
      provider,
      detected: await provider.detect(rootDir),
      dependencyFound: hasDependency(
        packageJson,
        ...(provider.dependencyPackages ?? []),
      ),
    });
  }
  return detections;
}

/**
 * Multi-select, re-prompting on an empty submit. Inquirer's checkbox needs
 * Space to toggle and Enter to submit, so a bare Enter silently selects
 * nothing — the most common way to "pick Supabase" and end up with only
 * zero-schema. Continuing with nothing requires an explicit yes.
 */
async function chooseProviders(
  detections: readonly ProviderDetection[],
  prompter: Prompter,
): Promise<string[]> {
  const choices = detections.map((detection) => ({
    name: describeDetection(detection),
    value: detection.provider.id,
    checked: detection.detected,
  }));
  for (;;) {
    const chosen = await prompter.checkbox(
      "Which data sources should boundary-guard trust as taint origins? (Space toggles, Enter submits; zero-schema heuristics are always on)",
      choices,
    );
    if (chosen.length > 0) return chosen;
    const proceed = await prompter.confirm(
      "Nothing selected. Continue with zero-schema heuristics only?",
      false,
    );
    if (proceed) return [];
  }
}

function describeDetection(detection: ProviderDetection): string {
  const { provider, detected, dependencyFound } = detection;
  if (detected) return `${provider.label} — detected`;
  if (dependencyFound) {
    return `${provider.label} — dependency found, but no schema/types file located (you'll be asked for a path)`;
  }
  return provider.label;
}

interface ConfiguredProvider {
  provider: SchemaProvider;
  config: ProviderConfig;
}

async function collectProviderConfigs(
  enabled: readonly SchemaProvider[],
  rootDir: string,
  prompter: Prompter,
): Promise<ConfiguredProvider[]> {
  const configured: ConfiguredProvider[] = [];
  for (const provider of enabled) {
    const config: ProviderConfig = { id: provider.id };
    for (const field of await provider.configFields(rootDir)) {
      config[field.key] = await prompter.input(
        `${provider.label}: ${field.message}`,
        field.defaultValue,
      );
    }
    configured.push({ provider, config });
  }
  return configured;
}

async function extractAll(
  enabled: readonly SchemaProvider[],
  configured: readonly ConfiguredProvider[],
  rootDir: string,
): Promise<{ sources: TaintSource[]; skipped: SkippedProvider[] }> {
  const sources: TaintSource[] = [];
  const skipped: SkippedProvider[] = [];
  for (const { provider, config } of configured) {
    if (!enabled.includes(provider)) continue;
    try {
      sources.push(...(await provider.extract(rootDir, config)));
    } catch (error) {
      if (error instanceof NotImplementedError) {
        skipped.push({ id: provider.id, reason: error.message });
        continue;
      }
      throw error;
    }
  }
  return { sources, skipped };
}
