"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/shared/button";
import { CloseIcon, MenuIcon, NpmIcon } from "@/components/shared/icons";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { site } from "@/config/site";

const PANEL_ID = "mobile-nav";

/**
 * The nav's small-screen half: a burger that opens the links the desktop row
 * shows inline.
 *
 * The breakpoint is the caller's — `md:hidden` on the button and the panel — so
 * this component never reads a viewport width and never renders twice into the
 * DOM. The panel is `absolute` off the nav's bottom edge, which is why the nav
 * itself carries `relative`.
 *
 * Closed on route change, on Escape, on a tap outside it, and on any link tap.
 * The pathname alone would miss `/#how-it-works`, since that is the current
 * route plus a hash, so the links close it as they are followed.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Wraps the button and the panel together, so "outside" means outside both:
  // a tap on the burger itself is the button's own toggle, not a dismissal.
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    // `pointerdown` rather than `click`: it lands before the target's own
    // handler, so tapping something else in the nav dismisses the panel and
    // still does what it was tapped to do.
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && !menu.current?.contains(target)) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={menu} className="flex items-center">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? "Close menu" : "Open menu"}
        // The secondary button's height (py-3 on a text-sm line) and border, as
        // a square rather than a pill, so it squares up with the star button.
        className="inline-flex size-11 items-center justify-center border border-[var(--color-divider)] hover:bg-[var(--color-surface)] md:hidden"
      >
        {open ? (
          <CloseIcon className="size-4" />
        ) : (
          <MenuIcon className="size-4" />
        )}
      </button>

      {open && (
        <div
          id={PANEL_ID}
          className="absolute inset-x-0 top-full flex flex-col border-b-2 border-[var(--color-divider)] bg-[var(--color-bg)] px-6 py-2 md:hidden"
        >
          <Link
            href="/#how-it-works"
            onClick={() => setOpen(false)}
            className="py-3.5 text-sm hover:text-accent-text"
          >
            How it works
          </Link>
          <a
            href={site.npmUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 py-3.5 text-sm hover:text-accent-text"
          >
            <NpmIcon className="size-4" />
            npm package
          </a>
          <div className="flex flex-wrap items-center gap-3 py-3.5">
            <ThemeToggle />
            <Button href={site.quickStart} variant="primary">
              Get Started
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
