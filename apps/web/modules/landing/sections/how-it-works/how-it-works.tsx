import {
  GridCell,
  GridGroup,
  SectionShell,
} from "@/modules/landing/sections/section-shell";

const STAGES = [
  {
    title: "Scan",
    body: "Parse the project into syntax trees and classify every file's boundary role.",
  },
  {
    title: "Detect",
    body: "Trace concrete values across React Flight, Server Actions, and route handlers.",
  },
  {
    title: "Understand",
    body: "Antra Studio shows the path a value took, from origin to the crossing that fired.",
  },
  {
    title: "Fix",
    body: "Insert a reasoned suppression, or change the code — `antra scan` confirms the fix.",
  },
];

export function HowItWorks() {
  return (
    <SectionShell
      id="how-it-works"
      kicker="How it works"
      title="Security checks, from code to production."
    >
      <GridGroup>
        {STAGES.map((stage, i) => (
          <GridCell key={stage.title}>
            <div className="mb-6 font-mono text-xs text-[var(--color-ink)]/50">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mb-3 font-heading text-lg font-extrabold">
              {stage.title}
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-ink)]/72">
              {stage.body}
            </p>
          </GridCell>
        ))}
      </GridGroup>
    </SectionShell>
  );
}
