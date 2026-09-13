export type DocHeading = { level: 2 | 3; text: string; id: string };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pull `##` and `###` headings out of raw MDX for the table of contents.
 * Headings inside fenced code blocks are skipped.
 */
export function extractHeadings(content: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let inFence = false;

  for (const line of content.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const level = match[1].length === 2 ? 2 : 3;
    const text = match[2].replace(/[*_`]/g, "");
    headings.push({ level, text, id: slugify(text) });
  }

  return headings;
}
