import Link from "next/link";

import { buttonClass, Button } from "@/components/shared/button";
import { NpmIcon } from "@/components/shared/icons";
import { Logo } from "@/components/shared/logo";
import { MobileMenu } from "@/components/shared/mobile-menu";
import { StarButton } from "@/components/shared/star-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { site } from "@/config/site";

/**
 * Two rows in one: the inline set from `md` up, and — below it — a burger that
 * carries the same links in a panel.
 *
 * `relative` is load-bearing: the panel is positioned off this element's bottom
 * edge, which is what lets it hang below a sticky nav without being clipped by
 * the nav's own height.
 *
 * No `flex-wrap`, deliberately. The old row wrapped instead of switching, so a
 * phone got two ragged lines of controls and no way to close them. Each set is
 * now hidden at the other's breakpoint, so exactly one is ever in flow.
 */
export function NavBar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center gap-5 border-b-2 border-[var(--color-divider)] bg-[var(--color-bg)] px-6 py-3.5">
      <Link
        href="/"
        className=" mr-auto flex items-center gap-2.5 font-wordmark text-lg tracking-tight"
      >
        <Logo className="h-5 w-10" />
        {site.name}
      </Link>

      <div className="hidden items-center gap-5 md:flex">
        <Link href="/#how-it-works" className="text-sm hover:text-accent-text">
          How it works
        </Link>
        <StarButton />
        <a
          href={site.npmUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="npm package antra-sec"
          className={buttonClass()}
        >
          <NpmIcon className="size-4" />
          npm
        </a>
        <ThemeToggle />
        <Button href={site.quickStart} variant="primary">
          Get Started
        </Button>
      </div>

      {/* Below `md`: the star stays on the bar — it is the one thing worth
          asking for without a tap — and everything else folds into the panel. */}
      <div className="flex items-center gap-3 md:hidden">
        <StarButton />
        <MobileMenu />
      </div>
    </nav>
  );
}
