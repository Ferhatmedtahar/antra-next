import {
  GridCell,
  GridGroup,
  SectionShell,
} from "@/modules/landing/sections/section-shell";

const DOES = [
  "Flag values that cross a trust boundary without validation",
  "Read sensitive-field names from your own schema providers",
  "Trace taint from a source to the crossing it reaches",
  "Respect sanitizers and suppressions you have already written",
  "Report on your source, with no network access",
];

const DOES_NOT = [
  "Scan your dependencies for published advisories",
  "Audit infrastructure, Docker, or Kubernetes manifests",
  "Detect leaked credentials or committed secrets",
  "Replace a runtime application firewall or a penetration test",
];

export function Scope() {
  return (
    <SectionShell
      id="scope"
      kicker="Scope"
      title="What it does, and what it does not."
      lede="A security tool is only useful if you know where it stops. Antra is deliberately narrow: it looks at how values move across boundaries in your own code."
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] border-t border-l border-[var(--color-divider)]">
        <GridCell>
          <div className="mb-6 font-heading text-sm font-semibold uppercase tracking-wide text-accent-500">
            Does
          </div>
          <ul className="space-y-3 text-sm leading-relaxed">
            {DOES.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="font-mono text-accent-500">+</span>
                <span className="text-[var(--color-ink)]/80">{item}</span>
              </li>
            ))}
          </ul>
        </GridCell>
        <GridCell>
          <div className="mb-6 font-heading text-sm font-semibold uppercase tracking-wide text-[var(--color-ink)]/55">
            Does not
          </div>
          <ul className="space-y-3 text-sm leading-relaxed">
            {DOES_NOT.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="font-mono text-[var(--color-ink)]/40">−</span>
                <span className="text-[var(--color-ink)]/80">{item}</span>
              </li>
            ))}
          </ul>
        </GridCell>
      </div>
      <GridGroup>
        <GridCell>
          <div className="mb-3 font-heading text-base font-extrabold">
            Two severities, not five
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-ink)]/72">
            Findings are <code className="font-mono">error</code> or{" "}
            <code className="font-mono">warning</code>. Nothing in between —
            because a level nobody agrees on is a level nobody acts on.
          </p>
        </GridCell>
      </GridGroup>
    </SectionShell>
  );
}
