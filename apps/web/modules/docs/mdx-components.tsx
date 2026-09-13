import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { CodeBlock } from "@/components/shared/code-block";
import { Note } from "@/components/shared/note";
import { Tabs } from "@/components/shared/tabs";
import { slugify } from "@/lib/toc-headings";

function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

function AnchorHeading({
  level,
  children,
  ...props
}: ComponentPropsWithoutRef<"h2"> & { level: 2 | 3 }) {
  const id = slugify(textOf(children));
  const Tag = level === 2 ? "h2" : "h3";

  return (
    <Tag
      id={id}
      className={
        level === 2
          ? "mt-12 mb-4 scroll-mt-20 border-t-2 border-[var(--color-divider)] pt-8 font-heading text-2xl font-extrabold tracking-tight"
          : "mt-8 mb-3 scroll-mt-20 font-heading text-lg font-extrabold tracking-tight"
      }
      {...props}
    >
      {children}
    </Tag>
  );
}

export const mdxComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <AnchorHeading level={2} {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <AnchorHeading level={3} {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 leading-relaxed text-[var(--color-ink)]/80" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="my-4 flex list-disc flex-col gap-2 pl-5 leading-relaxed"
      {...props}
    />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="my-4 flex list-decimal flex-col gap-2 pl-5 leading-relaxed"
      {...props}
    />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="text-[var(--color-ink)]/80" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-heading font-semibold" {...props} />
  ),
  a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) => {
    const external = /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className="text-accent-500 underline underline-offset-2 hover:text-accent-600"
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        {...props}
      />
    );
  },
  code: ({
    className,
    children,
    ...props
  }: ComponentPropsWithoutRef<"code">) => {
    const isBlock =
      typeof className === "string" && className.startsWith("language-");
    if (isBlock)
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    return (
      <code
        className="border border-[var(--color-divider)] bg-[var(--color-surface)] px-1 py-0.5 font-mono text-[0.9em]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="my-5 overflow-auto border border-[#3a3736] bg-[#1a1918] p-4 text-[13px] leading-relaxed text-[#f1efee]"
      {...props}
    />
  ),
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-5 border-l-2 border-accent-500 pl-4 text-[var(--color-ink)]/72 italic"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-t-2 border-[var(--color-divider)]" />,
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: ComponentPropsWithoutRef<"th">) => (
    <th
      className="border border-[var(--color-divider)] px-3 py-2 text-left font-heading font-semibold"
      {...props}
    />
  ),
  td: (props: ComponentPropsWithoutRef<"td">) => (
    <td
      className="border border-[var(--color-divider)] px-3 py-2 align-top text-[var(--color-ink)]/80"
      {...props}
    />
  ),
  Note: ({
    type,
    children,
  }: {
    type?: "tip" | "warning";
    children: ReactNode;
  }) => (
    <div className="my-6">
      <Note type={type}>{children}</Note>
    </div>
  ),
  CodeBlock,
  Tabs,
};
