import {
  GridCell,
  GridGroup,
  SectionShell,
} from "@/modules/landing/sections/section-shell";

const STEPS = ["Write Code", "Antra", "Find Issues", "Fix", "Ship Safely"];

export function BeforeYouPush() {
  return (
    <SectionShell
      id="before-you-push"
      kicker="Before you push"
      title="What if you caught it before you pushed?"
      lede="A value that crosses a trust boundary costs minutes to fix while the file is still open in your editor. The same crossing after release means an incident review and a deploy under pressure. Antra runs where the code is written, so the cheapest fix is also the first one available."
    >
      <GridGroup>
        {STEPS.map((step, i) => (
          <GridCell key={step}>
            <div className="mb-6 font-mono text-xs text-[var(--color-ink)]/50">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="font-heading text-lg font-extrabold">{step}</div>
          </GridCell>
        ))}
      </GridGroup>
    </SectionShell>
  );
}
