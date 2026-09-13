import { Button } from "@/components/shared/button";
import { FlowerCircleMirrorIcon } from "@/components/shared/shapes";
import { site } from "@/config/site";

export function Cta() {
  return (
    <section
      id="get-started"
      className="relative isolate overflow-hidden border-t-2 border-[var(--color-divider)]"
    >
      {/* The hero's grid, masked from the other end, so the page opens and
          closes on the same texture. */}
      <div className="grid-backdrop rotate-180" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-30 -z-10 select-none text-accent-text opacity-[0.06] blur-[2px]"
      >
        <FlowerCircleMirrorIcon className="size-64 md:size-96  animate-[spin_30s_linear_infinite] motion-reduce:animate-none" />
      </div>
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="flex flex-wrap items-end gap-10">
          <div className="min-w-0 flex-1 basis-[480px]">
            <h2 className="max-w-[20ch] text-[clamp(32px,4.4vw,60px)] leading-[1.08] tracking-tight">
              Run one scan. See{" "}
              <span className="text-accent-text">what crosses.</span>
            </h2>
            <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-[var(--color-ink)]/72">
              Antra is local, static, and fast. Point it at your App Router
              project and read the first report in a few minutes.
            </p>
          </div>
          <div className="flex flex-none flex-wrap gap-3">
            <Button href={site.quickStart} variant="primary">
              Get Started
            </Button>
            <Button href={site.githubUrl} external>
              View on GitHub
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
