"use client";

import { useState } from "react";

export function CodeBlock({
  lang,
  children,
}: {
  lang: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard API unavailable — nothing to fall back to
    }
  }

  return (
    <div className="border border-[var(--term-line,#3a3736)] bg-[#1a1918] text-[#f1efee]">
      <div className="flex items-center gap-3 border-b border-[#3a3736] px-4 py-2 text-[11px] font-mono uppercase tracking-wide text-[#9a9694]">
        <span>{lang}</span>
        <button
          type="button"
          onClick={copy}
          className="ml-auto border border-white/30 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide hover:border-accent-400 hover:text-accent-400"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-auto p-4 text-[13px] leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}
