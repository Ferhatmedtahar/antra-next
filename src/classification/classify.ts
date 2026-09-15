import type { AntraConfig } from "../config/types.js";
import type { TaintSource } from "../schema/types.js";

export interface SensitivityConfig {
  /** Name patterns, any language. */
  keywords: readonly string[];
  /** Exact field names or origins pinned as sensitive. */
  pinned: readonly string[];
  /** Exact field names or origins never sensitive — wins over everything. */
  ignored: readonly string[];
}

/** Builds the classifier input from a config; folds the legacy keywords.exclude into ignored. */
export function sensitivityFromConfig(
  config: Pick<AntraConfig, "keywords" | "sensitiveFields">,
): SensitivityConfig {
  return {
    keywords: config.keywords.include,
    pinned: config.sensitiveFields.include,
    ignored: [
      ...config.sensitiveFields.exclude,
      ...(config.keywords.exclude ?? []),
    ],
  };
}

/** `password_hash`, `passwordHash`, `PASSWORD-HASH` all become `passwordhash`. */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const normalizeFieldName = normalize;

/** `stripeCustomerId` / `stripe_customer_id` / `APIToken` → ["stripe", "customer", "id"] / ["api", "token"]. */
function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Keywords that are also ordinary English: as substrings they fire on
 * `totalTokens`, `secretaryName`, `tokenizer`. These (and anything ≤3
 * chars, where `ssn` would hit `previou-ssn-apshot`) must match whole
 * words. Every other keyword matches as a normalized substring, so
 * `password` still catches `passwordhash` and `motdepasse` catches
 * `mot_de_passe`.
 */
const WEAK_KEYWORDS = new Set([
  "token",
  "secret",
  "salt",
  "hash",
  "key",
  "pin",
]);
const WHOLE_WORD_MAX_LENGTH = 3;

function containsRun(haystack: readonly string[], needle: readonly string[]) {
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) {
      return true;
    }
  }
  return false;
}

function keywordMatches(name: string, keyword: string): boolean {
  const needle = normalize(keyword);
  if (needle.length === 0) return false;
  if (needle.length <= WHOLE_WORD_MAX_LENGTH || WEAK_KEYWORDS.has(needle)) {
    return containsRun(words(name), words(keyword));
  }
  return normalize(name).includes(needle);
}

/** An entry pins/ignores a field if it equals its origin exactly or its name modulo case/separators. */
function listed(
  entries: readonly string[],
  name: string,
  origin?: string,
): boolean {
  const normalized = normalize(name);
  return entries.some(
    (entry) => entry === origin || normalize(entry) === normalized,
  );
}

/**
 * Lexical sensitivity (ADR-002 Strategy D). Precedence: ignored → pinned →
 * keywords. Pinned/ignored exist because a keyword list can't know a
 * project's language or domain (`mot_de_passe`, `salary`, `internal_risk_score`).
 */
export function isSensitiveName(
  name: string,
  sensitivity: SensitivityConfig,
  origin?: string,
): boolean {
  if (listed(sensitivity.ignored, name, origin)) return false;
  if (listed(sensitivity.pinned, name, origin)) return true;
  return sensitivity.keywords.some((keyword) => keywordMatches(name, keyword));
}

export function classifySources(
  sources: readonly TaintSource[],
  sensitivity: SensitivityConfig,
): TaintSource[] {
  return sources.filter((source) =>
    isSensitiveName(source.field, sensitivity, source.origin),
  );
}
