/**
 * A docs page as plain markdown, for handing to an agent.
 *
 * The body is MDX, so pages using components (`<Tabs items={...} />`) carry
 * JSX tags through as-is. Agents read that fine; it is not clean prose and is
 * not intended to be.
 */

import type { DocSource } from "./get-docs-nav.js";

export function toMarkdown(doc: DocSource): string {
  const parts = [`# ${doc.meta.title}`];
  if (doc.meta.description) parts.push(doc.meta.description);
  parts.push(doc.content.trim());
  return `${parts.join("\n\n")}\n`;
}
