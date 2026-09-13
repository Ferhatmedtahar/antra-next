import { NavBar } from "@/components/shared/nav-bar";
import { getDocsNav } from "@/lib/get-docs-nav";
import { DocsSidebar } from "@/modules/docs/sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const groups = getDocsNav();

  return (
    <>
      <NavBar />
      <div className="mx-auto flex max-w-6xl flex-wrap gap-10 px-6 py-12">
        <DocsSidebar groups={groups} />
        <div className="min-w-0 flex-1 basis-[480px]">{children}</div>
      </div>
    </>
  );
}
