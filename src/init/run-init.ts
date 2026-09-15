import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

import { classifySources } from "../classification/classify.js";
import {
  DEFAULT_KEYWORDS,
  DEFAULT_RULES,
  DEFAULT_SANITIZERS,
} from "../config/defaults.js";
import type {
  AntraConfig,
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
import {
  agentSectionBody,
  CLAUDE_FILE_NAME,
  writeAgentSection,
  type AgentSectionStatus,
} from "./agent-context.js";
import type { Prompter } from "./prompter.js";

export type { SkippedProvider } from "../schema/extract.js";

/** Runs a codegen CLI (`supabase`, `npx prisma`, ...). Swappable in tests. */
export type CodegenRunner = (
  command: string,
  args: string[],
  options: { cwd: string },
) => Promise<{ stdout: string }>;

const execFileAsync = promisify(execFile);
const defaultCodegenRunner: CodegenRunner = (command, args, options) =>
  execFileAsync(command, args, options);

export interface InitOptions {
  rootDir: string;
  prompter: Prompter;
  adapters: readonly FrameworkAdapter[];
  providers: readonly SchemaProvider[];
  /** Executes codegen commands offered for missing schema files. Defaults to real child_process exec. */
  exec?: CodegenRunner;
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
      config: AntraConfig;
      snapshot: ContractSnapshot;
      configPath: string;
      snapshotPath: string;
      gitignore: GitignoreStatus;
      detections: ProviderDetection[];
      skipped: SkippedProvider[];
      /** Things worth telling the human that don't fit InitResult's shape: declined/failed/succeeded codegen offers, skipped answers. */
      notes: string[];
      /** What `antra init` did about agent guidance files, or null if declined. */
      agentContext: {
        agents: AgentSectionStatus;
        agentsMd: boolean;
        claudeMd: boolean;
      } | null;
    };

/**
 * The whole `init` flow, with every human interaction going through
 * `prompter`. Sequencing lives here — `cli/commands/init.ts` only builds
 * the real prompter and prints the result.
 */
export async function runInit(options: InitOptions): Promise<InitResult> {
  const {
    rootDir,
    prompter,
    adapters,
    providers,
    exec = defaultCodegenRunner,
  } = options;

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

  const notes: string[] = [];
  const providerConfigs = await collectProviderConfigs(
    enabled,
    rootDir,
    prompter,
    exec,
    notes,
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

  const config: AntraConfig = {
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

  // Agent guidance. Written to AGENTS.md always; additionally to CLAUDE.md
  // when the repo already has one, because Claude Code reads CLAUDE.md and
  // not AGENTS.md.
  const wantsAgentContext = await prompter.confirm(
    "Write Antra guidance into AGENTS.md so AI agents understand the security rules?",
    true,
  );

  let agentContext: {
    agents: AgentSectionStatus;
    agentsMd: boolean;
    claudeMd: boolean;
  } | null = null;

  if (wantsAgentContext) {
    const body = agentSectionBody();
    const hasClaudeMd = fs.existsSync(path.join(rootDir, CLAUDE_FILE_NAME));
    try {
      const agents = await writeAgentSection(rootDir, body);
      // The same marked section, written to the second file by the same
      // writer — so updating one never duplicates the other's surrounding
      // content.
      if (hasClaudeMd) {
        await writeAgentSection(rootDir, body, CLAUDE_FILE_NAME);
      }
      agentContext = { agents, agentsMd: true, claudeMd: hasClaudeMd };
    } catch (cause) {
      // A failed agent-context write must not fail init — the config is
      // already written and usable.
      notes.push(
        `Could not write AGENTS.md: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }
  }

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
    notes,
    agentContext,
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
      "Which data sources should antra trust as taint origins? (Space toggles, Enter submits; zero-schema heuristics are always on)",
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

/**
 * Per-provider "no schema file? generate one" offer. Keyed by the
 * configFields() field whose default is the conventional-but-missing path,
 * so the offer only fires for that field, not e.g. Supabase's env-var
 * fields. Each `run` calls a read-only introspection command (never one
 * that mutates the remote database) and returns the path it wrote/updated.
 */
const CODEGEN: Record<
  string,
  {
    fieldKey: string;
    manualHint: string;
    run(
      rootDir: string,
      prompter: Prompter,
      exec: CodegenRunner,
    ): Promise<string>;
  }
> = {
  supabase: {
    fieldKey: "typesPath",
    manualHint:
      "supabase gen types --local > types/database.types.ts   (or --linked / --project-id <ref> for a hosted project)",
    async run(rootDir, prompter, exec) {
      const mode = (
        await prompter.input(
          "Generate from: `local` dev DB, a `linked` project, or a project ref (paste it)?",
          "local",
        )
      ).trim();
      const args =
        mode === "" || mode === "local"
          ? ["gen", "types", "--local"]
          : mode === "linked"
            ? ["gen", "types", "--linked"]
            : ["gen", "types", "--project-id", mode];
      const outPath =
        (
          await prompter.input(
            "Where should the generated types file be written?",
            "types/database.types.ts",
          )
        ).trim() || "types/database.types.ts";
      const { stdout } = await exec("supabase", args, { cwd: rootDir });
      const absolute = path.resolve(rootDir, outPath);
      await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
      await fs.promises.writeFile(absolute, stdout, "utf8");
      return outPath;
    },
  },
  prisma: {
    fieldKey: "schemaPath",
    manualHint:
      "npx prisma db pull   (requires DATABASE_URL to be set; introspects your database into prisma/schema.prisma)",
    async run(rootDir, _prompter, exec) {
      await exec("npx", ["prisma", "db", "pull"], { cwd: rootDir });
      return "prisma/schema.prisma";
    },
  },
  drizzle: {
    fieldKey: "glob",
    manualHint:
      "npx drizzle-kit pull   (requires drizzle.config.ts with dbCredentials configured; writes drizzle/schema.ts)",
    async run(rootDir, _prompter, exec) {
      await exec("npx", ["drizzle-kit", "pull"], { cwd: rootDir });
      return "drizzle/schema.ts";
    },
  },
};

/** Words a human types at a path prompt that mean "no", never a real path. */
const REFUSALS = new Set(["n", "no", "skip", "none"]);

async function offerCodegen(
  provider: SchemaProvider,
  codegen: (typeof CODEGEN)[string],
  rootDir: string,
  prompter: Prompter,
  exec: CodegenRunner,
  notes: string[],
): Promise<string | null> {
  const manualFollowUp = `Generate it with:\n    ${codegen.manualHint}\n  then run \`antra init\` again and paste the file's path when asked.`;

  const wants = await prompter.confirm(
    `No ${provider.label} schema file was found. Generate one now using its CLI?`,
    true,
  );
  if (!wants) {
    notes.push(`${provider.label}: ${manualFollowUp}`);
    return null;
  }

  try {
    const generatedPath = await codegen.run(rootDir, prompter, exec);
    notes.push(`${provider.label}: generated ${generatedPath}.`);
    return generatedPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notes.push(
      `${provider.label}: generation failed (${message.split("\n")[0]}). ${manualFollowUp}`,
    );
    return null;
  }
}

async function collectProviderConfigs(
  enabled: readonly SchemaProvider[],
  rootDir: string,
  prompter: Prompter,
  exec: CodegenRunner,
  notes: string[],
): Promise<ProviderConfig[]> {
  const configs: ProviderConfig[] = [];
  for (const provider of enabled) {
    const codegen = CODEGEN[provider.id];
    // Offered once per provider: re-asking "generate one now?" after a
    // decline is just nagging, but the fields do need asking again when the
    // first pass produced nothing usable.
    let codegenOffered = false;

    for (;;) {
      const config: ProviderConfig = { id: provider.id };
      for (const field of await provider.configFields(rootDir)) {
        const isCodegenField = codegen?.fieldKey === field.key;
        const isMissingConventionalFile =
          isCodegenField &&
          field.defaultValue !== "" &&
          !fs.existsSync(path.resolve(rootDir, field.defaultValue));

        if (isMissingConventionalFile && !codegenOffered) {
          codegenOffered = true;
          const generated = await offerCodegen(
            provider,
            codegen,
            rootDir,
            prompter,
            exec,
            notes,
          );
          if (generated !== null) {
            config[field.key] = generated;
            continue;
          }
        }

        // Once the generate offer has been declined or has failed there is
        // no file to point at, so re-submitting the conventional path as a
        // default only invites an answer extract() has to reject. An empty
        // default makes Enter mean "skip this one".
        const suggested =
          isCodegenField && codegenOffered ? "" : field.defaultValue;

        const raw = (
          await prompter.input(`${provider.label}: ${field.message}`, suggested)
        ).trim();
        // A refusal word ("n", "skip", ...) is never a real path — treating it
        // as one silently fed a literal "n" into config, which then surfaced
        // as a confusing crash from extract() far away from this prompt.
        const answer = REFUSALS.has(raw.toLowerCase()) ? "" : raw;
        if (raw !== "" && answer === "") {
          notes.push(
            `${provider.label}: skipped "${field.key}" — you answered "${raw}". ${
              codegen
                ? `Generate it with:\n    ${codegen.manualHint}\n  then run \`antra init\` again and paste the file's path when asked.`
                : "Provide a real path next time, or leave it empty to skip."
            }`,
          );
        }
        // An empty answer means "skip this one" — it must not land in the
        // config as a blank key the provider would then try to honour.
        if (answer !== "") config[field.key] = answer;
      }

      if (await isViable(provider, rootDir, config)) {
        configs.push(config);
        break;
      }

      // Every field skipped, or answered in a way the provider cannot
      // extract from. Dropping it quietly is how a project ends up with a
      // config that reads as intact and a scan that finds nothing, so this
      // asks instead of assuming. Declining loops back to the fields.
      const proceed = await prompter.confirm(
        `${provider.label} has no usable source yet. Continue with zero-schema heuristics only?`,
        false,
      );
      if (!proceed) continue;

      notes.push(
        `${provider.label}: not configured for this run (zero-schema heuristics still apply).`,
      );
      break;
    }
  }
  return configs;
}

/**
 * "Configured" is not the same as "usable": `{ id, schema: "public" }` has
 * two keys and still extracts nothing, and a `typesPath` naming a file that
 * isn't there reads as configured right up until extract() throws. Providers
 * that can judge their own shape do; the rest keep the older "more than just
 * an id" rule.
 */
async function isViable(
  provider: SchemaProvider,
  rootDir: string,
  config: ProviderConfig,
): Promise<boolean> {
  if (provider.isViable) return provider.isViable(rootDir, config);
  return Object.keys(config).length > 1;
}
