"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ChevronIcon, CloseIcon } from "@/components/shared/icons";
import type { DocsNavGroup } from "@/lib/get-docs-nav";

/**
 * The docs tree itself, with every group collapsible.
 *
 * Shared by the desktop rail and the small-screen drawer, so a group header
 * behaves the same in both places rather than drifting into two dialects.
 *
 * Collapsed state is the *only* state: groups start open, and the set holds the
 * ones the reader has closed. That is what keeps server and client markup
 * identical on first paint — a default derived from the current page would have
 * to be computed twice, and would hydrate into a different tree.
 */
function DocsNavList({
  groups,
  onNavigate,
}: {
  groups: DocsNavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  function toggle(slug: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <>
      {groups.map((group) => {
        const key = group.slug || "root";
        const open = !collapsed.has(key);

        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={open}
              className="mb-3 flex w-full items-center justify-between gap-2 text-left text-[11px] font-heading font-semibold uppercase tracking-wide text-[var(--color-ink)]/55 hover:text-[var(--color-ink)]"
            >
              {group.title}
              <ChevronIcon
                className={`size-3 flex-none transition-transform duration-200 motion-reduce:transition-none ${
                  open ? "rotate-90" : ""
                }`}
              />
            </button>
            {open && (
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`block border-l-2 py-1 pl-3 text-sm leading-snug ${
                          active
                            ? "border-accent-text font-semibold text-accent-text"
                            : "border-transparent text-[var(--color-ink)]/72 hover:border-[var(--color-divider)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}

/** The rail, from `md` up. Hidden below it, where `DocsMenu` takes over. */
export function DocsSidebar({ groups }: { groups: DocsNavGroup[] }) {
  return (
    <aside className="hidden flex-none md:block md:w-56">
      <nav className="flex flex-col gap-7 md:sticky md:top-20">
        <DocsNavList groups={groups} />
      </nav>
    </aside>
  );
}

/**
 * Small screens: the tree behind one bar, as a drawer off the left edge.
 *
 * Mounted whether or not it is open, because a panel that enters the DOM on
 * open has nothing to animate from — it would pop in at its final position.
 * Closed, it is `invisible` rather than merely off-screen: `visibility: hidden`
 * takes the links out of the tab order, which `-translate-x-full` does not, and
 * `transition-all` holds the flip of that property until the slide finishes
 * going the other way.
 *
 * The drawer covers the nav rather than sitting under it, so nothing here needs
 * to know the nav's height. The bar travels with the nav instead of being
 * sticky itself: `DocsLayout` puts both in one sticky box, which is what keeps
 * the bar pinned under the nav without either knowing the other's height.
 */
export function DocsMenu({ groups }: { groups: DocsNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    // The page behind a modal drawer should not scroll under it. Mobile
    // browsers draw scrollbars as overlays, so hiding this one costs no width
    // and shifts no layout — and the drawer only exists below `md` anyway.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    // `preventScroll` because the document scrolls smoothly here; without it,
    // focusing a fixed element can still nudge the page behind the drawer.
    closeButton.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div className="border-b-2 border-[var(--color-divider)] bg-[var(--color-bg)] md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="docs-menu"
          className="flex w-full items-center gap-2 px-6 py-3.5 text-left text-sm font-heading font-semibold"
        >
          <ChevronIcon className="size-3.5 flex-none" />
          Menu
        </button>
      </div>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-200 motion-reduce:transition-none md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="docs-menu"
        aria-label="Documentation navigation"
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-[70] flex w-[86vw] max-w-xs flex-col border-r-2 border-[var(--color-divider)] bg-[var(--color-bg)] transition-all duration-200 motion-reduce:transition-none md:hidden ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <div className="flex flex-none items-center justify-between gap-4 border-b-2 border-[var(--color-divider)] px-6 py-3">
          <span className="font-heading text-sm font-extrabold">
            Documentation
          </span>
          <button
            ref={closeButton}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="inline-flex size-8 items-center justify-center border border-[var(--color-divider)] hover:bg-[var(--color-surface)]"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>
        <nav className="scrollbar-sleek flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-6 py-6">
          <DocsNavList groups={groups} onNavigate={() => setOpen(false)} />
        </nav>
      </aside>
    </>
  );
}
