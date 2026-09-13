type TerminalLine = { text: string; className?: string };

export function Terminal({
  title,
  lines,
}: {
  title: string;
  lines: TerminalLine[];
}) {
  return (
    <div className="border border-code-edge bg-code-bg font-mono text-sm leading-relaxed text-code-ink shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-5 border-b border-code-edge px-6 py-3 text-[11px] uppercase tracking-wide text-code-dim">
        <span>{title}</span>
        <span className="ml-auto">bash</span>
      </div>
      <div className="scrollbar-sleek space-y-1 overflow-x-auto px-6 py-5">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre ${line.className ?? "text-code-dim"}`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
