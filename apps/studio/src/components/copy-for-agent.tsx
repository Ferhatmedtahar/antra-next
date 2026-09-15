import { IconCopy, IconDots } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * One button that hands the finding to an AI coding agent.
 *
 * The marks shown say where the prompt goes, not which agent to choose — it is
 * the same prompt for all of them, and an ellipsis stands for the rest. Naming
 * these agents is nominative use: no partnership or endorsement is implied.
 *
 * `file` is the asset name, `name` is what the agent is called. They differ for
 * ChatGPT, whose mark is filed under its maker's name.
 */
const SHOWN = [
  { file: "claude", name: "Claude" },
  { file: "openai", name: "ChatGPT" },
  { file: "gemini", name: "Gemini" },
  { file: "cursor", name: "Cursor" },
] as const;

/** Everything worth naming in the tooltip, the drawn marks included. */
const ALL = [
  "Claude",
  "ChatGPT",
  "Gemini",
  "DeepSeek",
  "GitHub Copilot",
  "Cursor",
  "Codex CLI",
  "Windsurf",
];

export function CopyForAgent({ prompt }: { prompt: string }) {
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const shown = SHOWN.filter((agent) => !unavailable.has(agent.file));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Fix prompt copied", {
        description: "Paste it into your coding agent.",
      });
    } catch {
      toast.error("Could not copy", {
        description: "Your browser blocked clipboard access.",
      });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={`Copy a fix prompt for ${ALL.join(", ")}`}
      className="group rounded-big border-border/80 bg-surface-soft/40 hover:bg-surface-soft focus-ring flex w-full cursor-pointer items-center gap-3.5 border px-4 py-3 text-left transition-colors"
    >
      {shown.length > 0 ? (
        <span className="flex shrink-0 items-center gap-1.5">
          {shown.map((agent) => (
            <span
              key={agent.file}
              title={agent.name}
              className="rounded-icon border-border/70 bg-card flex size-7 items-center justify-center border"
            >
              {/* Monochrome via filters, so one asset works in both themes.
                  A missing file drops its chip rather than showing a broken
                  image — the row is the point, not any one mark. */}
              <img
                src={`/agents/${agent.file}.svg`}
                alt=""
                className="size-4 brightness-0 dark:invert"
                onError={() =>
                  setUnavailable((current) => new Set(current).add(agent.file))
                }
              />
            </span>
          ))}
          <span className="rounded-icon border-border/70 bg-card text-muted-foreground flex size-7 items-center justify-center border">
            <IconDots className="size-4" />
          </span>
        </span>
      ) : (
        // No brand asset landed. The button still works, so it falls back to
        // a single mark instead of an empty row of chips.
        <span className="rounded-icon bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center">
          <IconCopy className="size-4" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="text-label-3-sb text-foreground block">
          Copy to your agent
        </span>
        <span className="text-label-1-m text-muted-foreground block">
          Why it failed, every hop the value took, and the fix.
        </span>
      </span>

      <IconCopy className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
    </button>
  );
}
