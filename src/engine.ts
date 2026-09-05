import {
  classifyFile,
  type FileClassification,
} from "./ast/boundary-classifier.js";
import { loadProject } from "./ast/project.js";
import { TaintResolver } from "./ast/render-graph.js";
import {
  classifySources,
  sensitivityFromConfig,
  type SensitivityConfig,
} from "./classification/classify.js";
import { createSanitizerMatcher } from "./classification/sanitizers.js";
import { DEFAULT_KEYWORDS, DEFAULT_SANITIZERS } from "./config/defaults.js";
import { loadConfigIfPresent, loadSnapshot } from "./config/load.js";
import { requireFramework } from "./framework/detect.js";
import { rules, runRules, type Finding, type RuleId } from "./rules/index.js";
import type { TaintSource } from "./schema/types.js";
import { applySuppressions } from "./suppressions/suppressions.js";

export interface ScanOptions {
  rootDir: string;
  /** Run only these rules (after the config's own toggles). */
  onlyRules?: readonly RuleId[];
}

export interface ScanResult {
  frameworkAdapter: string;
  sourceRoot: string;
  /** False when the project was never `init`-ed — zero-schema heuristics only. */
  configPresent: boolean;
  classifications: FileClassification[];
  /** Everything the snapshot holds. */
  schemaFields: TaintSource[];
  /** The subset the classifier flags as sensitive — the real taint origins. */
  taintSources: TaintSource[];
  rulesRun: RuleId[];
  findings: Finding[];
  suppressed: Finding[];
}

/**
 * The only place scan pipeline steps get sequenced. Commands call this and
 * report; they never order steps themselves.
 *
 * detect framework → load config + snapshot → classify sensitive fields →
 * load project → classify boundaries → resolve taint at sinks + run rules →
 * apply suppressions. Persistence and reporters slot in after (Epic 05).
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const { rootDir } = options;
  const adapter = await requireFramework(rootDir);

  const config = await loadConfigIfPresent(rootDir);
  const snapshot = config ? await loadSnapshot(rootDir) : null;
  const schemaFields = snapshot?.sources ?? [];

  // Zero-schema heuristics are always on (ADR-002): without a config the
  // defaults still apply, there's just no snapshot to back them.
  const sensitivity: SensitivityConfig = config
    ? sensitivityFromConfig(config)
    : { keywords: DEFAULT_KEYWORDS, pinned: [], ignored: [] };
  const taintSources = classifySources(schemaFields, sensitivity);
  const sanitizer = createSanitizerMatcher(
    config?.sanitizers ?? DEFAULT_SANITIZERS,
  );

  const { project, sourceFiles } = loadProject(rootDir);
  const classificationList = sourceFiles.map(classifyFile);
  const classifications = new Map(
    classificationList.map((entry) => [entry.filePath, entry]),
  );

  const enabled = rules.filter(
    (rule) =>
      config?.rules[rule.id] !== false &&
      (!options.onlyRules || options.onlyRules.includes(rule.id)),
  );
  const resolver = new TaintResolver({ sensitivity, taintSources, sanitizer });
  const raw = runRules(
    sourceFiles,
    { rootDir, classifications, resolver, sanitizer },
    enabled,
  );
  const { active, suppressed } = applySuppressions(raw, (filePath) =>
    project.getSourceFile(filePath)?.getFullText(),
  );

  return {
    frameworkAdapter: adapter.id,
    sourceRoot: adapter.findSourceRoot(rootDir),
    configPresent: config !== null,
    classifications: classificationList,
    schemaFields,
    taintSources,
    rulesRun: enabled.map((rule) => rule.id),
    findings: active,
    suppressed,
  };
}
