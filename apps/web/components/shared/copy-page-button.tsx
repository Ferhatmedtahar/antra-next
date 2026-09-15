"use client";

import { useState } from "react";

/**
 * Copies the page as markdown, for pasting into an AI agent.
 *
 * Signals success on the button itself — the docs site has no toast layer, and
 * adding one for a single control would be more surface than the feature is
 * worth.
 */
export function CopyPageButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard API unavailable — nothing to fall back to
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy this page as markdown, ready to paste into an AI agent"
      className="border border-[var(--color-divider)] px-3 py-1.5 text-[11px] font-mono uppercase tracking-wide text-[var(--color-ink)]/60 transition-colors hover:border-accent-400 hover:text-accent-400"
    >
      {copied ? "Copied" : "Copy page"}
    </button>
  );
}
