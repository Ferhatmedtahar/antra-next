import { Button } from "@/components/shared/button";
import { site } from "@/config/site";

export default function DocsNotFound() {
  return (
    <div className="flex w-full flex-col items-start py-8">
      <div className="mb-4 inline-flex items-center justify-center border border-accent-500/30 bg-accent-500/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-accent-500">
        404 · Doc Not Found
      </div>
      <h1 className="mb-3 font-heading text-3xl font-extrabold tracking-tight md:text-4xl">
        Documentation page not found
      </h1>
      <p className="mb-8 max-w-xl text-lg leading-relaxed text-[var(--color-ink)]/70">
        The documentation page you requested does not exist or may have moved.
        Use the navigation on the left or try one of the following starting
        points:
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button href={site.docsHome} variant="primary">
          Introduction
        </Button>
        <Button href={site.quickStart} variant="secondary">
          Quick Start Guide
        </Button>
      </div>
    </div>
  );
}
