type TerminalLine = { text: string; className?: string };

export function Terminal({
  title,
  lines,
}: {
  title: string;
  lines: TerminalLine[];
}) {
  return (
    <div className="border border-[#3a3736] bg-[#1a1918] font-mono text-sm leading-relaxed text-[#f1efee] shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-5 border-b border-[#3a3736] px-6 py-3 text-[11px] uppercase tracking-wide text-[#9a9694]">
        <span>{title}</span>
        <span className="ml-auto">bash</span>
      </div>
      <div className="space-y-1 overflow-x-auto px-6 py-5">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre ${line.className ?? "text-[#9a9694]"}`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
