import { extractHeadings } from "@/lib/toc-headings";

export function Toc({ content }: { content: string }) {
  const headings = extractHeadings(content);
  if (headings.length === 0) return null;

  return (
    <nav className="hidden w-48 flex-none lg:block">
      <div className="sticky top-20">
        <div className="mb-3 text-[11px] font-heading font-semibold uppercase tracking-wide text-[var(--color-ink)]/55">
          On this page
        </div>
        <ul className="flex flex-col gap-1.5">
          {headings.map((heading) => (
            <li key={heading.id} className={heading.level === 3 ? "pl-3" : ""}>
              <a
                href={`#${heading.id}`}
                className="block text-[13px] leading-snug text-[var(--color-ink)]/60 hover:text-accent-500"
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
