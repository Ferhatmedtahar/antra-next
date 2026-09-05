import path from "path";

import {
  classifyFile,
  type FileClassification,
} from "./ast/boundary-classifier.js";
import { loadProject } from "./ast/project.js";
import { TaintResolver } from "./ast/render-graph.js";
import {
  assignFingerprints,
  loadBaseline,
  splitBaselined,
} from "./baseline/baseline.js";
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
import { FindingsStore } from "./storage/db.js";
import { applySuppressions } from "./suppressions/suppressions.js";

export interface ScanOptions {
  rootDir: string;
  /** Run only these rules (after the config's own toggles). */
  onlyRules?: readonly RuleId[];
  /** Treat every finding as new — what `baseline` needs to record them all. */
  ignoreBaseline?: boolean;
  /** Append this scan to .boundary-guard/findings.sqlite (default true). */
  store?: boolean;
  /** Progress hook for spinners; fired at the start of each phase. */
  onPhase?: (phase: ScanPhase, detail?: string) => void;
  /**
   * Run the rules only on these files (absolute paths). The whole project is
   * still parsed and classified so imports and boundaries resolve — this
   * limits where findings are reported, not what the resolver can see.
   */
  onlyFiles?: readonly string[];
  /** Human label for a partial scan ("git staged files"), shown by reporters. */
  scopeLabel?: string;
}

export interface ScanScope {
  /** True when `onlyFiles` restricted the rules to a subset. */
  partial: boolean;
  label: string;
  /** Files the rules actually ran on. */
  files: number;
}

export type ScanPhase =
  "detect" | "config" | "project" | "classify" | "rules" | "store";

export interface ScanResult {
  startedAt: string;
  durationMs: number;
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
  scope: ScanScope;
  /** New, unsuppressed findings — the ones that fail the gate. */
  findings: Finding[];
  suppressed: Finding[];
  /** Known before this scan (in .boundary-guard/baseline.json). */
  baselined: Finding[];
  /** Row id in findings.sqlite, when stored. */
  scanId: number | null;
  storeError: string | null;
}

/**
 * The only place scan pipeline steps get sequenced. Commands call this and
 * report; they never order steps themselves.
 *
 * detect framework → load config + snapshot → classify sensitive fields →
 * load project → classify boundaries → resolve taint at sinks + run rules →
 * fingerprint → suppressions → baseline → persist.
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const { rootDir } = options;
  const phase = options.onPhase ?? (() => undefined);
  const started = Date.now();
  phase("detect");
  const adapter = await requireFramework(rootDir);

  phase("config");
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

  phase("project");
  const { project, sourceFiles } = loadProject(rootDir);
  phase("classify", `${sourceFiles.length} files`);
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
  const onlyFiles = options.onlyFiles
    ? new Set(options.onlyFiles.map((file) => path.resolve(file)))
    : null;
  const ruleFiles = onlyFiles
    ? sourceFiles.filter((file) =>
        onlyFiles.has(path.resolve(file.getFilePath())),
      )
    : sourceFiles;
  phase(
    "rules",
    enabled.map((rule) => rule.id).join(", ") +
      (onlyFiles ? ` on ${ruleFiles.length} file(s)` : ""),
  );
  const raw = assignFingerprints(
    runRules(
      ruleFiles,
      { rootDir, classifications, resolver, sanitizer },
      enabled,
    ),
    rootDir,
  );
  const { active: unsuppressed, suppressed } = applySuppressions(
    raw,
    (filePath) => project.getSourceFile(filePath)?.getFullText(),
  );
  const baseline = options.ignoreBaseline ? null : await loadBaseline(rootDir);
  const { active, baselined } = splitBaselined(unsuppressed, baseline);

  const result: ScanResult = {
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    frameworkAdapter: adapter.id,
    sourceRoot: adapter.findSourceRoot(rootDir),
    configPresent: config !== null,
    classifications: classificationList,
    schemaFields,
    taintSources,
    rulesRun: enabled.map((rule) => rule.id),
    scope: {
      partial: onlyFiles !== null,
      label: options.scopeLabel ?? (onlyFiles ? "partial" : "whole project"),
      files: ruleFiles.length,
    },
    findings: active,
    suppressed,
    baselined,
    scanId: null,
    storeError: null,
  };

  if (options.store !== false) {
    phase("store");
    try {
      const store = FindingsStore.open(rootDir);
      try {
        result.scanId = store.saveScan(result, rootDir);
      } finally {
        store.close();
      }
    } catch (error) {
      // A read-only checkout (CI) must still get its report and exit code.
      result.storeError =
        error instanceof Error ? error.message : String(error);
    }
  }
  return result;
}
