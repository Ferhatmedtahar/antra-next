import { Button } from "@/components/shared/button";
import { AstroriskIcon } from "@/components/shared/shapes";
import { Terminal } from "@/components/shared/terminal";
import { site } from "@/config/site";

/**
 * Column widths from src/cli/progress.ts, so the illustration matches the scan
 * it depicts rather than approximating it.
 */
const LABEL_WIDTH = 25;
const DETAIL_WIDTH = 30;

/**
 * One completed step, exactly as `antra scan` prints it: two spaces, mark,
 * space, label padded to 25, two spaces, detail padded to 30, elapsed.
 *
 * Every line below is a real line the CLI emits. Nothing here names a check
 * the scanner does not run — no dependency audit, no env or secrets scan.
 */
const step = (label: string, detail: string, seconds: string) =>
  `  ✓ ${label.padEnd(LABEL_WIDTH)}  ${detail.padEnd(DETAIL_WIDTH)}${seconds}s`;

const SCAN_LINES = [
  { text: "$ antra scan", className: "text-code-ink" },
  { text: "antra scan" },
  { text: step("Detect framework", "nextjs-app-router", "0.12") },
  {
    text: step("Load config and snapshot", "antra.config.json", "0.03"),
  },
  { text: step("Parse project", "989 files", "17.30") },
  { text: step("Classify boundaries", "", "0.41") },
  { text: step("Link render graph", "412 edges", "0.05") },
  { text: step("Run rules", "", "1.20") },
  { text: step("Record findings", "", "0.01") },
  { text: " " },
  { text: "  project    ~/projects/checkout-app" },
  { text: "  framework  nextjs-app-router" },
  { text: "  rules      BG-001, BG-002, BG-003, BG-004" },
  { text: "  duration   19.1s" },
  { text: " " },
  { text: "  taint sources      5 sensitive of 558 schema field(s)" },
  { text: "  files scanned      989" },
  { text: "  client boundaries  12" },
  { text: " " },
  { text: "✖ 2 finding(s)  [BG-001 ×2]", className: "text-accent-400" },
];

export function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      <div className="grid-backdrop" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 -z-10 select-none text-accent-text opacity-10 blur-[2px] md:-right-30"
      >
        <AstroriskIcon className="size-72 md:size-96  animate-[spin_60s_linear_infinite] motion-reduce:animate-none" />
      </div>
      <div className="mx-auto max-w-6xl px-6 pt-16">
        <div className="mb-6 flex items-center gap-2 text-accent-500">
          <span className="font-heading text-sm font-extrabold text-[var(--color-ink)]">
            Developer security scanner
          </span>
        </div>
        <h1 className="mb-5 max-w-[19ch] text-[clamp(50px,7vw,88px)] leading-[1.05] tracking-tight">
          Catch security issues before they{" "}
          <span className="text-accent-text">cross the boundary.</span>
        </h1>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-6 pb-8">
          <p className="max-w-[56ch] flex-1 basis-110 text-lg leading-relaxed">
            {site.description}
          </p>
          <div className="flex flex-none gap-3">
            <Button href={site.quickStart} variant="primary">
              Start Scanning
            </Button>
            <Button href={site.docsHome}>Read the Docs</Button>
          </div>
        </div>
      </div>
      <div className="border-t-2 border-divider">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap gap-8">
            <div className="flex-none basis-40">
              <div className="text-[11px] uppercase tracking-wide text-ink/55">
                Local scan
              </div>
              <div className="mt-2 font-mono text-xs text-[var(--color-ink)]/55">
                cli
              </div>
            </div>
            <div className="min-w-0 flex-1 basis-[520px]">
              <Terminal title="~/projects/checkout-app" lines={SCAN_LINES} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
