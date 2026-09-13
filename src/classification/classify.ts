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

/** `stripeCustomerId` / `stripe_customer_id` → ["stripe", "customer", "id"]. */
function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Short keywords only match whole words, otherwise `ssn` fires on
 * `previou-ssn-apshot`. Longer ones match as substrings so `token` still
 * catches `accesstoken`.
 */
const WHOLE_WORD_MAX_LENGTH = 3;

function keywordMatches(name: string, keyword: string): boolean {
  const needle = normalize(keyword);
  if (needle.length === 0) return false;
  if (needle.length <= WHOLE_WORD_MAX_LENGTH)
    return words(name).includes(needle);
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
 * project's language or domain (`mot_de_passe`, `iban`, `salary`).
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
