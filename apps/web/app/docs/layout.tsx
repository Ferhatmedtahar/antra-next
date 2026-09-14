import { NavBar } from "@/components/shared/nav-bar";
import { getDocsNav } from "@/lib/get-docs-nav";
import { DocsMenu, DocsSidebar } from "@/modules/docs/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const groups = getDocsNav();

  return (
    <>
      <NavBar />
      {/* Below `md` the rail is gone, so the tree moves behind this bar. It
          sits outside the padded container to run the full width of the page,
          the way the nav above it does. */}
      <DocsMenu groups={groups} />
      <div className="mx-auto flex max-w-6xl flex-wrap gap-10 px-6 py-12">
        <DocsSidebar groups={groups} />
        <div className="min-w-0 flex-1 basis-[480px]">{children}</div>
      </div>
    </>
  );
}
