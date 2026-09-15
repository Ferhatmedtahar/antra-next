import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { site } from "@/config/site";
import { CopyPageButton } from "@/components/shared/copy-page-button";
import { toMarkdown } from "@/lib/doc-markdown";
import { getDocSlugs, getDocSource, getFlatDocsList } from "@/lib/get-docs-nav";
import { mdxComponents } from "@/modules/docs/mdx-components";
import { Pager } from "@/modules/docs/pager";
import { Toc } from "@/modules/docs/toc";

type Params = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return getDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocSource(slug ?? []);
  if (!doc) return {};

  return {
    title: doc.meta.title,
    description: doc.meta.description,
  };
}

export default async function DocPage({ params }: Params) {
  const { slug } = await params;

  // `/docs` has no page of its own — it opens the first page of the docs.
  if (!slug || slug.length === 0) redirect(site.docsHome);

  const doc = getDocSource(slug);
  if (!doc) notFound();

  const markdown = toMarkdown(doc);

  return (
    <div className="flex flex-wrap gap-10">
      <article className="min-w-0 flex-1 basis-[480px]">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-heading text-[clamp(28px,3.4vw,40px)] font-extrabold leading-tight tracking-tight">
            {doc.meta.title}
          </h1>
          <CopyPageButton markdown={markdown} />
        </div>
        {doc.meta.description ? (
          <p className="mb-2 max-w-[62ch] text-lg leading-relaxed text-[var(--color-ink)]/64">
            {doc.meta.description}
          </p>
        ) : null}
        <MDXRemote
          source={doc.content}
          components={mdxComponents}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        />
        <Pager items={getFlatDocsList()} slug={doc.slug} />
      </article>
      <Toc content={doc.content} />
    </div>
  );
}
