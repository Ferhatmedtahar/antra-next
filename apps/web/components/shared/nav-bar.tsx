import Link from "next/link";

import { Button } from "@/components/shared/button";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { site } from "@/config/site";

export function NavBar() {
  return (
    <nav className="sticky top-0 z-50 flex flex-wrap items-center gap-5 border-b-2 border-[var(--color-divider)] bg-[var(--color-bg)] px-6 py-3.5">
      <Link
        href="/"
        className="mr-auto flex items-center gap-2.5 font-heading text-lg font-extrabold tracking-tight"
      >
        <Logo className="h-5 w-10" />
        {site.name}
      </Link>
      <Link href="/#how-it-works" className="text-sm hover:text-accent-text">
        How it works
      </Link>
      <a
        href={site.githubUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm hover:text-accent-text"
      >
        GitHub
      </a>
      <ThemeToggle />
      <Button href={site.docsHome}>Docs</Button>
      <Button href={site.quickStart} variant="primary">
        Get Started
      </Button>
    </nav>
  );
}
