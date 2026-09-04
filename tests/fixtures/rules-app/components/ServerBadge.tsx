// Server Component: receiving a sensitive prop here is not a Flight crossing.
export function ServerBadge({ value }: { value: string }) {
  return <span>{value.length}</span>;
}
