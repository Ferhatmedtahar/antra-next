import { Button } from "@/components/shared/button";
import { site } from "@/config/site";

export function Cta() {
  return (
    <section
      id="get-started"
      className="border-t-2 border-[var(--color-divider)]"
    >
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="flex flex-wrap items-end gap-10">
          <div className="min-w-0 flex-1 basis-[480px]">
            <h2 className="max-w-[20ch] text-[clamp(32px,4.4vw,60px)] leading-[1.08] tracking-tight">
              Run one scan. See{" "}
              <span className="text-accent-500">what crosses.</span>
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
