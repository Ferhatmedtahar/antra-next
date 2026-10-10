/**
 * Writes Antra's guidance into the agent file a repo already uses.
 *
 * The section is delimited by HTML comment markers so re-running `antra init`
 * updates it in place instead of appending a second copy. Everything outside
 * the markers is preserved byte-for-byte — this file belongs to the user.
 */

import fs from "fs";
import path from "path";

export const AGENT_SECTION_START = "<!-- antra:start -->";
export const AGENT_SECTION_END = "<!-- antra:end -->";

/** The file agents read by convention. */
export const AGENT_FILE_NAME = "AGENTS.md";

/** Claude Code reads this one; written only when the repo already has it. */
export const CLAUDE_FILE_NAME = "CLAUDE.md";

export type AgentSectionStatus =
  "created" | "updated" | "appended" | "unchanged";

/** The marked block, markers included. */
function markedSection(body: string): string {
  return `${AGENT_SECTION_START}\n${body.trim()}\n${AGENT_SECTION_END}\n`;
}

/**
 * Writes into `rootDir/<filename>`. Returns what changed.
 *
 * `"unchanged"` matters: `antra init` is re-run often, and rewriting an
 * identical file churns git status for no reason.
 */
export async function writeAgentSection(
  rootDir: string,
  body: string,
  filename: string = AGENT_FILE_NAME,
): Promise<AgentSectionStatus> {
  const file = path.join(rootDir, filename);
  const section = markedSection(body);

  if (!fs.existsSync(file)) {
    await fs.promises.writeFile(file, section, "utf8");
    return "created";
  }

  const current = await fs.promises.readFile(file, "utf8");
  const start = current.indexOf(AGENT_SECTION_START);
  const end = current.indexOf(AGENT_SECTION_END);

  if (start !== -1 && end !== -1 && end > start) {
    const next = `${current.slice(0, start)}${section.trimEnd()}${current.slice(
      end + AGENT_SECTION_END.length,
    )}`;
    if (next === current) return "unchanged";
    await fs.promises.writeFile(file, next, "utf8");
    return "updated";
  }

  const separator = current.endsWith("\n") ? "\n" : "\n\n";
  await fs.promises.writeFile(file, `${current}${separator}${section}`, "utf8");
  return "appended";
}

/** The guidance `antra init` writes. Kept short — it is read on every agent turn. */
export function agentSectionBody(): string {
  return [
    "## Security: React Server Components trust boundaries",
    "",
    "This project is scanned by [Antra](https://github.com/Ferhatmedtahar/antra-next).",
    "It checks one thing: whether sensitive server-side data crosses into the",
    "client without validation.",
    "",
    '**The boundary.** A file with `"use client"` runs in the browser. A Server',
    "Component, Server Action, or route handler runs on the server. Every prop",
    "passed to a Client Component, every Server Action return value, and every",
    "route response is serialized over the network. TypeScript types are erased",
    "at compile time and protect nothing here.",
    "",
    "**What it flags.**",
    "",
    "- `BG-001` — a specific sensitive field (password hash, token, secret,",
    "  billing id) reaches the client.",
    "- `BG-002` — a Server Action or route handler accepts external input without",
    "  runtime validation. Types are not validation.",
    "- `BG-003` — a whole database row or API response is passed to the client",
    "  without field projection, leaking every column the query returns.",
    "- `BG-004` — a secret is rendered directly into markup.",
    "",
    "**Rules for fixing.**",
    "",
    "- Project explicit fields instead of passing whole objects or spreading them.",
    "- Validate untrusted input with a runtime schema (Zod, Valibot, ArkType).",
    "- Never silence a real flow with an `antra-disable` comment — fix it. Only",
    "  suppress a verified false positive, with a reason.",
    "- The check is `npx antra scan --fail-on error` (use `pnpm exec`, `yarn`, or",
    "  `bunx` to match this project's package manager).",
  ].join("\n");
}
