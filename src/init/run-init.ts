import { classifySources } from "../classification/classify.js";
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
import { ensureGitignore, type GitignoreStatus } from "../config/gitignore.js";
import {
  CONFIG_FILENAME,
  configExists,
  writeConfig,
  writeSnapshot,
} from "../config/write.js";
import { requireFramework } from "../framework/detect.js";
import type { FrameworkAdapter } from "../framework/types.js";
import { extractSources, type SkippedProvider } from "../schema/extract.js";
import type { SchemaProvider } from "../schema/types.js";
import { hasDependency, readPackageJson } from "../utils/package-json.js";
import type { Prompter } from "./prompter.js";

export type { SkippedProvider } from "../schema/extract.js";

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

export type InitResult =
  | { status: "aborted"; reason: string }
  | {
      status: "completed";
      frameworkAdapter: string;
      config: BoundaryGuardConfig;
      snapshot: ContractSnapshot;
      configPath: string;
      snapshotPath: string;
      gitignore: GitignoreStatus;
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

  const { sources, skipped } = await extractSources(
    rootDir,
    providerConfigs,
    (id) => providers.find((provider) => provider.id === id),
  );

  // Seed sensitiveFields.include with what the default keywords flagged,
  // so the config file *shows* the sensitive list and the user edits that
  // list directly. sync never rewrites it; keywords keep applying on top
  // at scan time, so columns added later are still caught.
  const seeded = classifySources(sources, {
    keywords: DEFAULT_KEYWORDS,
    pinned: [],
    ignored: [],
  }).map((source) => source.origin);

  const config: BoundaryGuardConfig = {
    version: 1,
    frameworkAdapter: adapter.id,
    providers: providerConfigs,
    keywords: { include: [...DEFAULT_KEYWORDS] },
    sensitiveFields: { include: seeded, exclude: [] },
    sanitizers: [...DEFAULT_SANITIZERS],
    rules: { ...DEFAULT_RULES },
  };
  const snapshot: ContractSnapshot = {
    generatedAt: new Date().toISOString(),
    sources,
  };

  const configPath = await writeConfig(rootDir, config, { overwrite: true });
  const snapshotPath = await writeSnapshot(rootDir, snapshot);
  const gitignore = await ensureGitignore(rootDir);

  return {
    status: "completed",
    frameworkAdapter: adapter.id,
    config,
    snapshot,
    configPath,
    snapshotPath,
    gitignore: gitignore.status,
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

async function collectProviderConfigs(
  enabled: readonly SchemaProvider[],
  rootDir: string,
  prompter: Prompter,
): Promise<ProviderConfig[]> {
  const configs: ProviderConfig[] = [];
  for (const provider of enabled) {
    const config: ProviderConfig = { id: provider.id };
    for (const field of await provider.configFields(rootDir)) {
      const answer = (
        await prompter.input(
          `${provider.label}: ${field.message}`,
          field.defaultValue,
        )
      ).trim();
      // An empty answer means "skip this one" — it must not land in the
      // config as a blank key the provider would then try to honour.
      if (answer !== "") config[field.key] = answer;
    }
    configs.push(config);
  }
  return configs;
}
