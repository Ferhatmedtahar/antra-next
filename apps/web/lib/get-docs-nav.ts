import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

/**
 * The docs tree is the folder tree. Nothing here is hand-maintained: adding
 * `content/docs/<group>/<page>.mdx` puts a page in the sidebar, and the
 * frontmatter of each file decides its title and position.
 *
 * Frontmatter contract:
 *   title:       string   (falls back to a title-cased filename)
 *   description: string   (optional — used for the meta description)
 *   order:       number   (optional, default 999 — sorts within a group; a
 *                          group takes the smallest order of its pages)
 */
const DOCS_DIR = path.join(process.cwd(), "content", "docs");
const DEFAULT_ORDER = 999;

export type DocsFrontmatter = {
  title: string;
  description?: string | undefined;
  order: number;
};

export type DocsNavItem = {
  title: string;
  /** Slash-joined path without extension, e.g. "commands/scan". */
  slug: string;
  href: string;
  order: number;
  description?: string | undefined;
};

export type DocsNavGroup = {
  title: string;
  /** First path segment, or "" for pages sitting at the docs root. */
  slug: string;
  order: number;
  items: DocsNavItem[];
};

export type DocSource = {
  slug: string;
  meta: DocsFrontmatter;
  content: string;
};

/** Folder names that do not read right title-cased, e.g. "ci" → "Ci". */
const GROUP_TITLES: Record<string, string> = {
  ci: "CI",
};

function humanize(segment: string): string {
  if (!segment) return "Docs";
  const override = GROUP_TITLES[segment];
  if (override) return override;
  return segment
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function listMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    const rel = String(entry);
    if (rel.endsWith(".mdx") && !rel.split(path.sep).includes("node_modules")) {
      found.push(rel);
    }
  }
  return found.sort();
}

function slugFromRelPath(relPath: string): string {
  const segments = relPath.replace(/\.mdx$/, "").split(path.sep);
  // `getting-started/introduction.mdx` → getting-started/introduction
  // `getting-started/index.mdx`        → getting-started
  if (segments.length > 1 && segments[segments.length - 1] === "index") {
    segments.pop();
  }
  return segments.join("/");
}

function readDoc(relPath: string): DocSource | null {
  const raw = fs.readFileSync(path.join(DOCS_DIR, relPath), "utf8");
  const { data, content } = matter(raw);
  const slug = slugFromRelPath(relPath);
  const lastSegment = slug.split("/").pop() ?? slug;

  return {
    slug,
    meta: {
      title:
        typeof data.title === "string" ? data.title : humanize(lastSegment),
      description:
        typeof data.description === "string" ? data.description : undefined,
      order: typeof data.order === "number" ? data.order : DEFAULT_ORDER,
    },
    content,
  };
}

let navCache: DocsNavGroup[] | null = null;

export function getDocsNav(): DocsNavGroup[] {
  if (navCache) return navCache;

  const groups = new Map<string, DocsNavGroup>();

  for (const relPath of listMdxFiles(DOCS_DIR)) {
    const doc = readDoc(relPath);
    if (!doc) continue;

    const segments = doc.slug.split("/");
    const groupSlug = segments.length > 1 ? (segments[0] ?? "") : "";

    let group = groups.get(groupSlug);
    if (!group) {
      group = {
        title: humanize(groupSlug),
        slug: groupSlug,
        order: doc.meta.order,
        items: [],
      };
      groups.set(groupSlug, group);
    }

    group.items.push({
      title: doc.meta.title,
      slug: doc.slug,
      href: `/docs/${doc.slug}`,
      order: doc.meta.order,
      description: doc.meta.description,
    });
  }

  const result = [...groups.values()];
  for (const group of result) {
    group.items.sort(
      (a, b) => a.order - b.order || a.title.localeCompare(b.title),
    );
    group.order = Math.min(...group.items.map((item) => item.order));
  }
  result.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  navCache = result;
  return result;
}

export function getFlatDocsList(): DocsNavItem[] {
  return getDocsNav().flatMap((group) => group.items);
}

export function getDocSlugs(): string[][] {
  const seen = new Set<string>();
  const slugs: string[][] = [];

  for (const relPath of listMdxFiles(DOCS_DIR)) {
    const slug = slugFromRelPath(relPath);
    if (seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug.split("/"));
  }

  return slugs;
}

export function getDocSource(slug: string[]): DocSource | null {
  const wanted = slug.join("/");

  for (const relPath of listMdxFiles(DOCS_DIR)) {
    if (slugFromRelPath(relPath) === wanted) return readDoc(relPath);
  }

  return null;
}
