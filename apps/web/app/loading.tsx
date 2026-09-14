import { NavBar } from "@/components/shared/nav-bar";
import { Skeleton } from "@/components/shared/skeleton";

/**
 * Route-transition placeholder for the landing page.
 *
 * `app/loading.tsx` is the boundary the router reaches for when a navigation
 * crosses between route groups — `/` to the docs tree and back — because that
 * is the segment whose children change. `(marketing)/loading.tsx` is the nearer
 * one, and covers `/` from anywhere inside the group. Both must therefore paint
 * the same thing, so the work lives here and the group file points at it rather
 * than restating it.
 *
 * It follows the page it stands in for: the nav for real, so it does not blink
 * out, then the hero's own bands — eyebrow, headline, lede and button row — and
 * the scanner band under them. Same widths as `hero.tsx`, so nothing shifts
 * when the real content lands. No copy: there is nothing useful to say while a
 * page loads, and the layout already says it.
 */
export default function Loading() {
  return (
    <>
      <NavBar />
      <div role="status" aria-label="Loading page">
        <div className="mx-auto max-w-6xl px-6 pt-20 md:pt-28">
          <Skeleton className="mb-8 h-5 w-56" />

          <Skeleton className="mb-3 h-[clamp(52px,7.4vw,92px)] w-full max-w-3xl" />
          <Skeleton className="h-[clamp(52px,7.4vw,92px)] w-2/3 max-w-xl" />

          <div className="flex flex-wrap items-center gap-x-10 gap-y-8 pt-7 pb-12 md:pb-16">
            <div className="flex-1 basis-110 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="flex flex-none gap-3">
              <Skeleton className="h-11 w-36" />
              <Skeleton className="h-11 w-36" />
            </div>
          </div>
        </div>

        <div className="border-t-2 border-divider">
          <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
            <div className="flex flex-wrap gap-8">
              <div className="flex-none basis-40 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-72 min-w-0 flex-1 basis-[520px]" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
