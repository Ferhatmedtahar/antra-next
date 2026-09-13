"use client";

import { useState } from "react";

type TabItem = { label: string; code: string };

export function Tabs({
  items,
  lang = "bash",
}: {
  items: TabItem[];
  lang?: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="flex flex-wrap border-b-2 border-[var(--color-divider)]">
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActive(i)}
            className={`-mb-0.5 border-b-2 px-4 py-2 font-mono text-xs ${
              i === active
                ? "border-accent-text text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-ink)]/60 hover:text-accent-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <CodeBlockBody lang={lang} code={items[active]?.code ?? ""} />
    </div>
  );
}

function CodeBlockBody({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="border border-t-0 border-code-edge bg-code-bg text-code-ink">
      <pre className="scrollbar-sleek overflow-auto p-4 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
      <div className="sr-only">{lang}</div>
    </div>
  );
}
