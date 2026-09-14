import { Skeleton } from "@/components/shared/skeleton";

/**
 * Placeholder for a documentation page. The nav and the sidebar rail belong to
 * the docs layout and are already mounted, so only the article column and the
 * on-this-page rail are stubbed in — the same two columns the page renders, at
 * the same widths, so the swap costs no shift.
 */
export default function DocsLoading() {
  return (
    <div role="status" aria-label="Loading documentation page">
      <div className="flex flex-wrap gap-10">
        <div className="min-w-0 flex-1 basis-[480px]">
          <Skeleton className="mb-3 h-9 w-2/3 max-w-md" />
          <Skeleton className="mb-10 h-5 w-11/12 max-w-lg" />

          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          <Skeleton className="my-10 h-56 w-full" />

          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>

        <div className="hidden w-48 flex-none lg:block">
          <Skeleton className="mb-3 h-3 w-24" />
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}
