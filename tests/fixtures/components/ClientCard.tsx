"use client";

interface ClientCardProps {
  title: string;
  token?: string;
}

export function ClientCard({ title, token }: ClientCardProps) {
  return <div data-token={token}>{title}</div>;
}
