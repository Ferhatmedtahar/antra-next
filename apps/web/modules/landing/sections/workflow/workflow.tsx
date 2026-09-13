import {
  GridCell,
  GridGroup,
  SectionShell,
} from "@/modules/landing/sections/section-shell";

const STEPS = [
  {
    title: "Install",
    body: "Add Antra as a dev dependency and run `antra init` to write a config for your project.",
  },
  {
    title: "Run",
    body: "`antra scan` reports findings in the terminal, as JSON, or as SARIF for your code host.",
  },
  {
    title: "Gate",
    body: "`--fail-on-violation` turns a scan into a non-zero exit code your pipeline can block on.",
  },
  {
    title: "Review",
    body: "`antra studio` opens the graph view for triage when a finding needs human judgement.",
  },
];

export function Workflow() {
  return (
    <SectionShell
      id="workflow"
      kicker="Workflow"
      title="Fits the pipeline you already have."
      lede="Antra runs as a CLI step. There is nothing to host and nothing to install on a server — a GitHub Action, a generic CI job, or a pre-commit hook all work the same way."
    >
      <GridGroup>
        {STEPS.map((step, i) => (
          <GridCell key={step.title}>
            <div className="mb-6 font-mono text-xs text-[var(--color-ink)]/50">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mb-3 font-heading text-lg font-extrabold">
              {step.title}
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-ink)]/72">
              {step.body}
            </p>
          </GridCell>
        ))}
      </GridGroup>
    </SectionShell>
  );
}
