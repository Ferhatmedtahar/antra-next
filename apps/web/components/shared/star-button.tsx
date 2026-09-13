import { buttonClass } from "@/components/shared/button";
import { GithubIcon, StarIcon } from "@/components/shared/icons";
import { site } from "@/config/site";
import { formatStars, getRepoStars } from "@/lib/github-stars";

/**
 * The repo link, wearing a live star count.
 *
 * A server component so the count is in the HTML — no skeleton, no layout
 * shift, and nothing for a client to fetch on a page that is otherwise static.
 * It borrows the secondary button's class list rather than restating the
 * padding, which is what keeps it the same height as Docs and Get Started
 * beside it.
 *
 * When the count is unavailable the separator and the number are dropped
 * together, leaving the same button with one fewer word — the label carries the
 * link either way.
 */
export async function StarButton() {
  const stars = await getRepoStars();

  return (
    <a
      href={site.githubUrl}
      target="_blank"
      rel="noreferrer"
      className={buttonClass()}
    >
      <GithubIcon className="size-4" />
      Star
      {stars !== null && (
        <span className="flex items-center gap-1.5 border-l border-[var(--color-divider)] pl-2.5 text-[var(--color-ink)]/55">
          <StarIcon className="size-3.5" />
          {formatStars(stars)}
        </span>
      )}
    </a>
  );
}
