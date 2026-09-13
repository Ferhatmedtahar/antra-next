"use client";

import Link from "next/link";
import { useEffect } from "react";

import { buttonClass } from "@/components/shared/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center px-6 py-20 text-[var(--color-ink)]">
      <div className="flex w-full max-w-xl flex-col items-center border border-[var(--color-divider)] bg-[var(--color-surface)] p-10 text-center md:p-14">
        <div className="mb-4 inline-flex items-center justify-center border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-red-500">
          Application Error
        </div>
        <h1 className="mb-3 font-heading text-3xl font-bold tracking-tight md:text-4xl">
          Something went wrong
        </h1>
        <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--color-ink)]/70">
          We encountered an unexpected error while processing this page. Please
          try again.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className={buttonClass("primary")}
          >
            Try Again
          </button>
          <Link href="/" className={buttonClass("secondary")}>
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
