import {
  classifyFile,
  type FileClassification,
} from "./ast/boundary-classifier.js";
import { loadProject } from "./ast/project.js";
import { requireFramework } from "./framework/detect.js";

export interface ScanOptions {
  rootDir: string;
}

export interface ScanResult {
  frameworkAdapter: string;
  sourceRoot: string;
  classifications: FileClassification[];
}

/**
 * The only place scan pipeline steps get sequenced. Commands call this and
 * report; they never order steps themselves. Today: detect framework →
 * load project → classify boundaries. Taint tracking, rules, suppressions
 * and persistence slot in here as Epics 03–05 land.
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const { rootDir } = options;
  const adapter = await requireFramework(rootDir);
  const { sourceFiles } = loadProject(rootDir);
  return {
    frameworkAdapter: adapter.id,
    sourceRoot: adapter.findSourceRoot(rootDir),
    classifications: sourceFiles.map(classifyFile),
  };
}
