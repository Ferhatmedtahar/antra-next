export default function DocsLoading() {
  return (
    <div className="flex w-full animate-pulse flex-col gap-6 py-4">
      {/* Title skeleton */}
      <div className="h-10 w-2/3 max-w-md bg-[var(--color-divider)]" />
      {/* Description skeleton */}
      <div className="h-6 w-5/6 max-w-lg bg-[var(--color-divider)] opacity-60" />

      {/* Body lines skeleton */}
      <div className="mt-8 space-y-4">
        <div className="h-4 w-full bg-[var(--color-divider)] opacity-40" />
        <div className="h-4 w-11/12 bg-[var(--color-divider)] opacity-40" />
        <div className="h-4 w-4/5 bg-[var(--color-divider)] opacity-40" />
      </div>

      <div className="mt-6 space-y-4">
        <div className="h-4 w-full bg-[var(--color-divider)] opacity-40" />
        <div className="h-4 w-5/6 bg-[var(--color-divider)] opacity-40" />
      </div>
    </div>
  );
}
