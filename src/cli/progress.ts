import { Chalk, type ChalkInstance } from "chalk";

import { DISPLAY_NAME } from "../brand.js";
import type { ScanPhase } from "../engine.js";

/** One line per phase, in the order the engine emits them. */
const STEP_LABEL: Record<ScanPhase, string> = {
  detect: "Detect framework",
  config: "Load config and snapshot",
  project: "Parse project",
  classify: "Classify boundaries",
  graph: "Link render graph",
  rules: "Run rules",
  store: "Record findings",
};

const LABEL_WIDTH = Math.max(...Object.values(STEP_LABEL).map((l) => l.length));
const DETAIL_WIDTH = 30;

/** Pad to `width`, or truncate with an ellipsis so the columns stay aligned. */
function fit(text: string, width: number): string {
  return text.length > width
    ? `${text.slice(0, width - 1)}…`
    : text.padEnd(width);
}

interface Pending {
  phase: ScanPhase;
  /**
   * Required but nullable: with `exactOptionalPropertyTypes`, an optional
   * `detail?: string` cannot be assigned an explicit `undefined`.
   */
  detail: string | undefined;
  /** When the phase was announced — which is when the step began. */
  startedAt: number;
}

/**
 * The slice of the previous spinner handle the CLI calls. Kept call-compatible
 * so the call sites did not have to change when the animation went away.
 */
export interface ProgressHandle {
  /** Rewrites the detail of the step in flight; a no-op between steps. */
  text: string;
  isSpinning: boolean;
  start(): ProgressHandle;
  /** Prints the step in flight as done. Call before rendering anything else. */
  settle(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  info(text: string): void;
  warn(text: string): void;
  stopAndPersist(options?: { text?: string }): void;
  stop(): void;
}

/**
 * Renders the scan's phases as a static list of completed steps.
 *
 * Deliberately not a spinner: the phases are announced around synchronous
 * ts-morph work, so an animated frame timer never gets to run and the display
 * freezes on its first frame. A line printed when the *next* phase starts is
 * truthful — it means this one finished — and needs no interval, no cursor
 * control, and nothing to clean up on the way out.
 *
 * Writes to stderr so `--format json` on stdout stays parseable.
 */
class StepList implements ProgressHandle {
  private readonly c: ChalkInstance;
  private pending: Pending | null = null;

  constructor(
    private readonly out: NodeJS.WriteStream,
    color: boolean,
  ) {
    this.c = new Chalk(color ? {} : { level: 0 });
  }

  header(verb: string): void {
    this.out.write(`${this.c.bold(DISPLAY_NAME)} ${this.c.gray(verb)}\n`);
  }

  get text(): string {
    return this.pending === null ? "" : (this.pending.detail ?? "");
  }

  set text(value: string) {
    if (this.pending !== null) this.pending.detail = value;
  }

  start(): ProgressHandle {
    return this;
  }

  /**
   * The previous step is done the moment the next phase is announced.
   *
   * A phase may be announced twice: once when it starts, so a failure has a
   * step to mark, and once when it finishes with the detail it learned. The
   * second announcement refines the line rather than opening a new one.
   */
  begin(phase: ScanPhase, detail?: string): void {
    if (this.pending !== null && this.pending.phase === phase) {
      this.pending.detail = detail;
      return;
    }
    this.settle();
    this.pending = { phase, detail, startedAt: Date.now() };
  }

  settle(): void {
    this.flush("✓", (text) => this.c.green(text));
  }

  fail(): void {
    this.flush("✖", (text) => this.c.red(text));
  }

  succeed(): void {
    this.settle();
  }

  info(text: string): void {
    this.settle();
    this.out.write(`${this.c.gray(`  ${text}`)}\n`);
  }

  warn(text: string): void {
    this.settle();
    this.out.write(`${this.c.yellow(`  ${text}`)}\n`);
  }

  /** Ora's signature, so a call site that persisted a line keeps working. */
  stopAndPersist(options?: { text?: string }): void {
    if (options?.text !== undefined) this.info(options.text);
    else this.settle();
  }

  get isSpinning(): boolean {
    return this.pending !== null;
  }

  stop(): void {
    this.settle();
  }

  private flush(mark: string, paint: (text: string) => string): void {
    const step = this.pending;
    if (step === null) return;
    this.pending = null;
    const elapsed = (Date.now() - step.startedAt) / 1000;
    const label = fit(STEP_LABEL[step.phase], LABEL_WIDTH);
    const detail = fit(step.detail ?? "", DETAIL_WIDTH);
    this.out.write(
      `  ${paint(mark)} ${label}  ${this.c.gray(`${detail} ${elapsed.toFixed(2)}s`)}\n`,
    );
  }
}

/**
 * Terminal progress for `antra scan`. Steps go to stderr; color follows that
 * stream, so a redirected or CI run gets the same lines without escape codes.
 */
export function scanSpinner(initial = "scan"): {
  spinner: ProgressHandle;
  onPhase: (phase: ScanPhase, detail?: string) => void;
} {
  const out = process.stderr;
  const color = out.isTTY === true && process.env.NO_COLOR === undefined;
  const steps = new StepList(out, color);
  steps.header(initial);
  return {
    spinner: steps,
    onPhase: (phase, detail) => steps.begin(phase, detail),
  };
}
