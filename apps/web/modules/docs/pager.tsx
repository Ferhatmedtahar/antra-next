import Link from "next/link";

import type { DocsNavItem } from "@/lib/get-docs-nav";

export function Pager({ items, slug }: { items: DocsNavItem[]; slug: string }) {
  const index = items.findIndex((item) => item.slug === slug);
  if (index === -1) return null;

  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index < items.length - 1 ? items[index + 1] : undefined;
  if (!previous && !next) return null;

  return (
    <nav className="mt-16 flex flex-wrap gap-4 border-t-2 border-[var(--color-divider)] pt-6">
      {previous ? (
        <Link
          href={previous.href}
          className="min-w-0 flex-1 basis-52 border border-[var(--color-divider)] px-4 py-3 hover:bg-[var(--color-surface)]"
        >
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink)]/55">
            Previous
          </div>
          <div className="mt-1 font-heading text-sm font-semibold">
            {previous.title}
          </div>
        </Link>
      ) : null}
      {next ? (
        <Link
          href={next.href}
          className="min-w-0 flex-1 basis-52 border border-[var(--color-divider)] px-4 py-3 text-right hover:bg-[var(--color-surface)]"
        >
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink)]/55">
            Next
          </div>
          <div className="mt-1 font-heading text-sm font-semibold">
            {next.title}
          </div>
        </Link>
      ) : null}
    </nav>
  );
}
