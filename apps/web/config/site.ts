export const site = {
  name: "Antra",
  tagline: "Catch security issues before they cross the boundary.",
  description:
    "Antra is a static analysis security linter for React Server Components and the Next.js App Router. It finds the exact point where a value crosses a trust boundary without validation.",
  githubUrl: "https://github.com/Ferhatmedtahar/antra-next",
  npmUrl: "https://www.npmjs.com/package/@ferhattahar/antra-next",
  licenseUrl: "https://github.com/Ferhatmedtahar/antra-next/blob/main/LICENSE",
  /** `owner/name`, read by the star count in the nav. */
  githubRepo: "Ferhatmedtahar/antra-next",
  docsHome: "/docs/getting-started/introduction",
  quickStart: "/docs/getting-started/quick-start",
  /**
   * Absolute origin for machine-readable output. Empty until the docs site has
   * a configured domain, in which case llms.txt emits site-relative links —
   * which resolve for any agent fetching from the origin that served it.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "",
} as const;
