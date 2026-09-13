import { Button } from "@/components/shared/button";
import { Footer } from "@/components/shared/footer";
import { NavBar } from "@/components/shared/nav-bar";
import { site } from "@/config/site";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-ink)]">
      <NavBar />
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="flex w-full max-w-xl flex-col items-center border border-[var(--color-divider)] bg-[var(--color-surface)] p-10 text-center md:p-14">
          <div className="mb-4 inline-flex items-center justify-center border border-accent-text/30 bg-accent-500/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-accent-text">
            404 Error
          </div>
          <h1 className="mb-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
            Page not found
          </h1>
          <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--color-ink)]/70">
            The page you are looking for doesn&apos;t exist, was moved, or is
            temporarily unavailable.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button href={site.docsHome} variant="primary">
              Browse Documentation
            </Button>
            <Button href="/" variant="secondary">
              Back to Home
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
