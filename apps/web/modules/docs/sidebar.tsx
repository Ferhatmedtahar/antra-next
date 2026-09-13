"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DocsNavGroup } from "@/lib/get-docs-nav";

export function DocsSidebar({ groups }: { groups: DocsNavGroup[] }) {
  const pathname = usePathname();

  return (
    <aside className="w-full flex-none md:w-56">
      <nav className="flex flex-col gap-7 md:sticky md:top-20">
        {groups.map((group) => (
          <div key={group.slug || "root"}>
            <div className="mb-3 text-[11px] font-heading font-semibold uppercase tracking-wide text-[var(--color-ink)]/55">
              {group.title}
            </div>
            <ul className="flex flex-col gap-1.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.slug}>
                    <Link
                      href={item.href}
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
          </div>
        ))}
      </nav>
    </aside>
  );
}
