export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** `supabase:public.users.password_hash` → { provider, container: "public.users" } */
export function splitOrigin(origin: string): {
  provider: string;
  container: string;
} {
  const [provider = "", rest = ""] = origin.split(/:(.+)/, 2);
  const container = rest.slice(0, Math.max(0, rest.lastIndexOf(".")));
  return { provider, container };
}

export function suppressionComment(ruleId: string): string {
  return `// boundary-guard-disable-next-line ${ruleId} reason=""`;
}
