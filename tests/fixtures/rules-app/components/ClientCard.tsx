"use client";

export function ClientCard(props: Record<string, unknown>) {
  return <div>{String(props.title ?? "")}</div>;
}
