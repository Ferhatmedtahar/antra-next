import ora, { type Ora } from "ora";

import type { ScanPhase } from "../engine.js";

const PHASE_TEXT: Record<ScanPhase, (detail?: string) => string> = {
  detect: () => "Detecting framework…",
  config: () => "Loading config and snapshot…",
  project: () => "Parsing the project…",
  classify: (detail) => `Classifying ${detail ?? "files"}…`,
  graph: () => "Linking the render graph…",
  rules: (detail) => `Running rules${detail ? ` (${detail})` : ""}…`,
  store: () => "Recording the scan…",
};

/**
 * Terminal spinner for the long phases. Writes to stderr, so `--format json`
 * on stdout stays clean; ora disables itself when stderr isn't a TTY (CI).
 */
export function scanSpinner(initial = "Starting…"): {
  spinner: Ora;
  onPhase: (phase: ScanPhase, detail?: string) => void;
} {
  const spinner = ora({ text: initial, stream: process.stderr }).start();
  return {
    spinner,
    onPhase: (phase, detail) => {
      spinner.text = PHASE_TEXT[phase](detail);
    },
  };
}
