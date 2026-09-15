/**
 * Defaults `init` writes into a fresh config. Written out explicitly (not
 * hidden in code) so the user can see and edit exactly what the tool
 * treats as sensitive, trusted, and enabled.
 */

export const DEFAULT_KEYWORDS: readonly string[] = [
  // Credentials.
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
  // Payment and banking identifiers. Every entry has to be a thing no client
  // legitimately displays, which is why `stripe`, `session` and `hash` are not
  // here (`stripe_fee_pct`, `session_unlock_threshold_pct`, `content_hash` are
  // all ordinary UI values) and why `pin` is not either — `map_pin` is a
  // coordinate, and whole-word matching does not save it.
  "iban",
  "account_number",
  "routing_number",
  "bank_account",
  "card_number",
  "cvv",
  "cvc",
  "recovery_code",
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
