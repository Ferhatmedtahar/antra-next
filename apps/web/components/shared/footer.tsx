import { Logo } from "@/components/shared/logo";
import { site } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t-2 border-[var(--color-divider)]">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-10 px-6 py-14">
        <div className="min-w-0 flex-1 basis-72">
          <div className="mb-2 flex items-center gap-2.5 font-heading text-lg font-extrabold">
            <Logo className="h-5 w-10" />
            {site.name}
          </div>
          <p className="text-sm text-[var(--color-ink)]/60">{site.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-8 text-sm">
          <a href="/#how-it-works">How it works</a>
          <a href="/#checks">Checks</a>
          <a href={site.docsHome}>Documentation</a>
          <a href={site.githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
