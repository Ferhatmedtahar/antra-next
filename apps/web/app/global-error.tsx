"use client";

import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en" className="scrollbar-sleek">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-6 py-20 text-[var(--color-ink)] antialiased">
        <div className="flex w-full max-w-xl flex-col items-center border border-[var(--color-divider)] bg-[var(--color-surface)] p-10 text-center md:p-14">
          <div className="mb-4 inline-flex items-center justify-center border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-red-500">
            Critical Error
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
            Something went wrong
          </h1>
          <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--color-ink)]/70">
            A critical error stopped the application from rendering. Refresh the
            page, or go back home.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 bg-accent-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
            >
              Try Again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 border border-[var(--color-divider)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface)]"
            >
              Return Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
