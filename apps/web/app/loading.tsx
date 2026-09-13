export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center px-6 py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 animate-spin border-2 border-accent-text border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink)]/60">
          Loading...
        </p>
      </div>
    </div>
  );
}
