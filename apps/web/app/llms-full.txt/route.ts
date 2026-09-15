import { toMarkdown } from "@/lib/doc-markdown";
import { getDocSource, getFlatDocsList } from "@/lib/get-docs-nav";

// Every page is read from disk, so this belongs in the static build.
export const dynamic = "force-static";

/** The whole docs tree as one markdown file, for an agent that wants it all. */
export function GET() {
  const pages: string[] = [];

  for (const item of getFlatDocsList()) {
    const doc = getDocSource(item.slug.split("/"));
    if (doc) pages.push(toMarkdown(doc).trimEnd());
  }

  return new Response(`${pages.join("\n\n---\n\n")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
