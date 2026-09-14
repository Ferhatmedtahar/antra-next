/**
 * Defaults `init` writes into a fresh config. Written out explicitly (not
 * hidden in code) so the user can see and edit exactly what the tool
 * treats as sensitive, trusted, and enabled.
 */

export const DEFAULT_KEYWORDS: readonly string[] = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "private_key",
  "credential",
  "ssn",
  "salt",
  "otp",
];

/** Validators that break the taint chain when they wrap a value (FR7). */
export const DEFAULT_SANITIZERS: readonly string[] = [
  "zod",
  "next-safe-action",
];

export const DEFAULT_RULES: Readonly<Record<string, boolean>> = {
  "BG-001": true,
  "BG-002": true,
  "BG-003": true,
  "BG-004": true,
};
