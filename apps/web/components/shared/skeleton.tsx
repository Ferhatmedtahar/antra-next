/**
 * The placeholder bar every route-level `loading.tsx` is built from.
 *
 * `--color-divider` is the ink: a low-alpha tint of the page's own ink, so a
 * bar sits on the same ground the real content lands on and never needs a
 * colour of its own. Square edges, like everything else on this surface.
 *
 * The pulse belongs to the bar, not to a wrapper around a group of them —
 * opacity on a parent would compound with the children's and flicker darker
 * wherever two bars overlap.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-[var(--color-divider)] motion-reduce:animate-none ${className}`}
    />
  );
}
