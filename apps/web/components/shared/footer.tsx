import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { site } from "@/config/site";

/**
 * One affordance for every footer link: the nav's accent tint, plus the rule
 * under it. The rule is the load-bearing half — these sit in a row of plain
 * text, so without it they read as labels until the pointer is already on one.
 */
const LINK =
  "text-sm hover:text-accent-text hover:underline hover:underline-offset-4";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-[var(--color-divider)]">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-10 px-6 py-14">
        <div className="min-w-0 flex-1 basis-72">
          {/* Same mark and wordmark as the nav, class for class: the
              `font-wordmark` token is Anton, and Anton is single-weight, so the
              old `font-extrabold` was a no-op here rather than a heavier name. */}
          <Link
            href="/"
            className="mb-2 flex w-fit items-center gap-2.5 font-wordmark text-lg tracking-tight"
          >
            <Logo className="h-5 w-10" />
            {site.name}
          </Link>
          <p className="text-sm text-[var(--color-ink)]/60">{site.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-8">
          <a href="/#how-it-works" className={LINK}>
            How it works
          </a>
          <a href="/#checks" className={LINK}>
            Checks
          </a>
          <Link href={site.docsHome} className={LINK}>
            Documentation
          </Link>
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noreferrer"
            className={LINK}
          >
            GitHub
          </a>
        </nav>
      </div>

      {/* The colophon: who holds the copyright and under what terms. A hairline
          rather than the footer's own two-pixel rule, so it reads as a footnote
          to the links instead of a fifth one. */}
      <div className="border-t border-[var(--color-divider)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-5 text-xs text-[var(--color-ink)]/60">
          <span>© {year} Antra</span>
          <a
            href={site.licenseUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-accent-text hover:underline hover:underline-offset-4"
          >
            MIT License
          </a>
          {/* `#top` is the one hash a browser resolves with no element behind
              it: it scrolls the document to the start. No id to add anywhere,
              and it animates like any other anchor. */}
          <a
            href="#top"
            className="ml-auto hover:text-accent-text hover:underline hover:underline-offset-4"
          >
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
