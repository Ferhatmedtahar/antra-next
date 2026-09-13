import { CircleFlowerIcon } from "@/components/shared/shapes";
import {
  GridCell,
  GridGroup,
  SectionShell,
} from "@/modules/landing/sections/section-shell";

const CHECKS = [
  {
    title: "RSC / Server-Client boundary crossings",
    body: "Detects values passed from Server Components into Client Components through the React Flight payload.",
  },
  {
    title: "Schema-aware sensitive-field detection",
    body: "Reads your schema to know which fields are sensitive, with providers for Prisma, Zod, Supabase, OpenAPI, and Drizzle.",
  },
  {
    title: "Taint tracking",
    body: "Follows a value from its source through the call graph to the boundary it crosses.",
  },
  {
    title: "Sanitizer-aware suppression",
    body: "Recognizes the sanitizers you already use and stays quiet when a value has been validated.",
  },
];

export function Checks() {
  return (
    <SectionShell
      id="checks"
      kicker="Checks"
      title="What Antra actually looks for."
      lede="Antra is a static analysis security linter. Every check below runs on your source, locally, with no network calls and no code leaving the machine."
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-1 -left-10 -z-10 select-none text-accent-text opacity-[0.07] blur-[2px]"
      >
        <CircleFlowerIcon className="size-48 md:size-64  animate-[spin_35s_linear_infinite] motion-reduce:animate-none" />
      </div>
      <GridGroup>
        {CHECKS.map((check, i) => (
          <GridCell key={check.title}>
            <div className="mb-6 font-mono text-xs text-[var(--color-ink)]/50">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mb-3 font-heading text-lg font-extrabold">
              {check.title}
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-ink)]/72">
              {check.body}
            </p>
          </GridCell>
        ))}
      </GridGroup>
    </SectionShell>
  );
}
