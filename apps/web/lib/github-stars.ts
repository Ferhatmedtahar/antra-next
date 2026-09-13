import { site } from "@/config/site";

/**
 * How long a fetched star count is reused. Long, because a star count is
 * decoration: it is never worth a request on the critical path, and the
 * unauthenticated GitHub API allows 60 requests an hour per IP — a whole site
 * building from one CI address would otherwise spend that budget on renders.
 */
const REVALIDATE_SECONDS = 3600;

/**
 * The repo's star count, or `null` when it cannot be read.
 *
 * `null` rather than `0`, and rather than throwing: the caller renders a
 * countless button for it. A rate-limited build, an offline CI runner, or a
 * repo that has been renamed should all cost the number and nothing else — the
 * link to the repo is the point of the button, the count is the flourish.
 *
 * Unauthenticated requests are fine for a public repo. Setting `GITHUB_TOKEN`
 * raises the hourly cap from 60 to 5,000, which is the only reason to set it.
 */
export async function getRepoStars(): Promise<number | null> {
  const token = process.env.GITHUB_TOKEN;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${site.githubRepo}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );

    if (!response.ok) return null;

    const repo = (await response.json()) as { stargazers_count?: unknown };
    return typeof repo.stargazers_count === "number"
      ? repo.stargazers_count
      : null;
  } catch {
    return null;
  }
}

/**
 * A star count short enough to sit in a nav: `842`, `1.2k`, `12k`.
 *
 * One decimal below ten thousand, none above, because the second digit stops
 * carrying meaning once the first has three leading it — and both stops fit the
 * same handful of characters.
 */
export function formatStars(count: number): string {
  if (count < 1000) return String(count);

  const thousands = count / 1000;
  return thousands < 10
    ? `${thousands.toFixed(1)}k`
    : `${Math.round(thousands)}k`;
}
