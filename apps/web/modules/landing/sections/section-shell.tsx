import type { ReactNode } from "react";

export function SectionShell({
  id,
  kicker,
  title,
  lede,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="relative isolate overflow-hidden border-t-2 border-[var(--color-divider)]"
    >
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 flex flex-wrap gap-8">
          <div className="flex-none basis-40 text-[11px] font-heading font-semibold uppercase tracking-wide text-accent-text">
            {kicker}
          </div>
          <div className="min-w-0 flex-1 basis-[480px]">
            <h2 className="max-w-[24ch] text-[clamp(28px,3.4vw,44px)] leading-tight tracking-tight">
              {title}
            </h2>
            {lede ? (
              <p className="mt-4 max-w-[62ch] text-base text-[var(--color-ink)]/72">
                {lede}
              </p>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export function GridGroup({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] border-t border-l border-[var(--color-divider)]">
      {children}
    </div>
  );
}

export function CellWash() {
  return <div aria-hidden className="cell-wash" />;
}

export function GridCell({
  children,
  corner,
}: {
  children: ReactNode;
  corner?: ReactNode;
}) {
  return (
    <div className="cell-wash-host border-r border-b border-[var(--color-divider)] px-6 py-8">
      <CellWash />
      {children}
      {corner ? <div className="cell-corner">{corner}</div> : null}
    </div>
  );
}
