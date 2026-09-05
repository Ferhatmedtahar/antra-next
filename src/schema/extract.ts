import type { ProviderConfig } from "../config/types.js";
import { NotImplementedError, SchemaExtractionError } from "./errors.js";
import { findProvider } from "./providers/index.js";
import type { SchemaProvider, TaintSource } from "./types.js";

export interface SkippedProvider {
  id: string;
  reason: string;
}

export interface ExtractOutcome {
  sources: TaintSource[];
  skipped: SkippedProvider[];
}

/**
 * Runs every configured provider's extract() and unions the results —
 * providers merge, they don't compete (Epic 01 README). Deduped by origin.
 * A provider whose extract() isn't implemented is reported, not fatal; any
 * other failure propagates with the provider named.
 */
export async function extractSources(
  rootDir: string,
  providerConfigs: readonly ProviderConfig[],
  resolve: (id: string) => SchemaProvider | undefined = findProvider,
): Promise<ExtractOutcome> {
  const byOrigin = new Map<string, TaintSource>();
  const skipped: SkippedProvider[] = [];

  for (const config of providerConfigs) {
    const provider = resolve(config.id);
    if (!provider)
      throw new Error(`Unknown schema provider in config: "${config.id}"`);
    try {
      for (const source of await provider.extract(rootDir, config)) {
        byOrigin.set(source.origin, source);
      }
    } catch (error) {
      if (error instanceof NotImplementedError) {
        skipped.push({ id: provider.id, reason: error.message });
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new SchemaExtractionError(provider.id, message, { cause: error });
    }
  }
  return { sources: [...byOrigin.values()], skipped };
}
