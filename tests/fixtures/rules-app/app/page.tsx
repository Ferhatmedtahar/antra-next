import { ClientCard } from "../components/ClientCard";
import { ServerBadge } from "../components/ServerBadge";
import { db } from "../lib/db";
import { profileSchema } from "../lib/schema";

export default async function Page() {
  const user = await db.user.findUnique({ where: { id: 1 } });
  const res = await fetch("https://api.internal/me");
  const me = await res.json();
  const safe = { name: user.name, email: user.email };
  const cleaned = profileSchema.parse(me);
  const { password_hash: hashed, ...rest } = user;

  return (
    <main>
      <ClientCard hash={user.password_hash} />
      <ClientCard token={me.auth_token} />
      <ClientCard profile={me} />
      <ClientCard user={safe} />
      <ClientCard secret={process.env.STRIPE_SECRET_KEY} />
      <ClientCard site={process.env.NEXT_PUBLIC_SITE_URL} />
      <ClientCard validated={cleaned} />
      <ClientCard hashed={hashed} />
      <ClientCard {...rest} />
      <ServerBadge value={user.password_hash} />
      <p>{user.password_hash}</p>
      {/* boundary-guard-disable-next-line BG-001 reason="public share token" */}
      <ClientCard token={user.share_token} />
      <ClientCard>{user.password_hash}</ClientCard>
    </main>
  );
}
