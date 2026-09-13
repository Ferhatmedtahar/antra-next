"use client";

import Link from "next/link";
import { useEffect } from "react";

import { buttonClass } from "@/components/shared/button";
import { site } from "@/config/site";

export default function DocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Docs error:", error);
  }, [error]);

  return (
    <div className="flex w-full flex-col items-start py-8 text-[var(--color-ink)]">
      <div className="mb-4 inline-flex items-center justify-center border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-red-500">
        Error Loading Document
      </div>
      <h1 className="mb-3 font-heading text-3xl font-extrabold tracking-tight md:text-4xl">
        Could not load documentation
      </h1>
      <p className="mb-8 max-w-xl text-lg leading-relaxed text-[var(--color-ink)]/70">
        An unexpected error occurred while loading this documentation page.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className={buttonClass("primary")}
        >
          Try Again
        </button>
        <Link href={site.docsHome} className={buttonClass("secondary")}>
          Back to Docs Home
        </Link>
      </div>
    </div>
  );
}
