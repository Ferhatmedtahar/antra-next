import { site } from "@/config/site";
import { getDocsNav } from "@/lib/get-docs-nav";

// The docs pages are prerendered via generateStaticParams; these routes should
// be too, rather than served per request.
export const dynamic = "force-static";

/**
 * An index of the docs for LLMs, following llmstxt.org.
 *
 * llmstxt.org wants absolute links, but a relative one resolves correctly for
 * any agent that fetched this file from the origin that served it — so an
 * unconfigured domain degrades sanely instead of emitting a wrong one.
 */
function link(href: string): string {
  return site.url ? new URL(href, site.url).toString() : href;
}

export function GET() {
  const lines = [`# ${site.name}`, "", `> ${site.description}`, "", "## Docs"];

  for (const group of getDocsNav()) {
    for (const item of group.items) {
      const description = item.description ? `: ${item.description}` : "";
      lines.push(`- [${item.title}](${link(item.href)})${description}`);
    }
  }

  lines.push(
    "",
    "## Optional",
    `- [Full documentation as one file](${link("/llms-full.txt")})`,
  );

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
