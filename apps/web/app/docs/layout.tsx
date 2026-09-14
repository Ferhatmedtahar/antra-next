import { Footer } from "@/components/shared/footer";
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
      {/* Below `md` the rail is gone, so the tree moves behind this bar. It
          sits outside the padded container to run the full width of the page,
          the way the nav above it does.

          Nav and bar share one sticky box so the bar parks directly under the
          nav: nesting makes that offset the nav's own height rather than a
          number to keep in sync with `py-3.5`. The drawer the bar opens is
          `fixed`, and a sticky ancestor is not a containing block for it, so
          the panel still covers the whole viewport including the nav. */}
      <div className="sticky top-0 z-50">
        <NavBar />
        <DocsMenu groups={groups} />
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap gap-10 px-6 py-12">
        <DocsSidebar groups={groups} />
        <div className="min-w-0 flex-1 basis-[480px]">{children}</div>
      </div>
      <Footer />
    </>
  );
}
