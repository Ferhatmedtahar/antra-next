import type { ReactNode } from "react";

export function Note({
  type = "tip",
  children,
}: {
  type?: "tip" | "warning";
  children: ReactNode;
}) {
  return (
    <div className="border-l-2 border-accent-text bg-accent-100 px-4 py-3 text-sm dark:bg-accent-900/40">
      <div className="mb-1 text-[11px] font-heading font-semibold uppercase tracking-wide text-accent-800 dark:text-accent-300">
        {type === "warning" ? "Warning" : "Note"}
      </div>
      <div className="leading-relaxed text-accent-900 dark:text-accent-100">
        {children}
      </div>
    </div>
  );
}
