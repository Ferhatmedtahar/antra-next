import { z } from "zod";

/**
 * A provider entry in the config: `id` selects the provider, every other
 * key is that provider's own settings (Prisma's `schemaPath`, OpenAPI's
 * `spec`, ...). Kept loose on purpose — each provider validates its own
 * shape inside extract(); the config file doesn't need to know them all.
 */
export const providerConfigSchema = z.looseObject({
  id: z.string().min(1),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

/** `boundary-guard.config.json` — the user's decisions (FR-INIT-6). */
export const boundaryGuardConfigSchema = z.object({
  version: z.literal(1),
  frameworkAdapter: z.string().min(1),
  providers: z.array(providerConfigSchema),
  /** Name patterns: substring (≥4 chars) or whole-word (≤3) — any language. */
  keywords: z.object({
    include: z.array(z.string()),
    /** Legacy alias for sensitiveFields.exclude. */
    exclude: z.array(z.string()).optional(),
  }),
  /**
   * The sensitive-field list, by exact origin (`supabase:public.users.iban`)
   * or exact field name. `init` seeds include with the keyword hits; the
   * user edits from there. include = always sensitive; exclude = never
   * sensitive and wins over everything.
   */
  sensitiveFields: z
    .object({
      include: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default([]),
    })
    .default({ include: [], exclude: [] }),
  sanitizers: z.array(z.string()),
  rules: z.record(z.string(), z.boolean()),
});
export type BoundaryGuardConfig = z.infer<typeof boundaryGuardConfigSchema>;

export const taintSourceSchema = z.object({
  field: z.string().min(1),
  origin: z.string().min(1),
});

/** `.boundary-guard/contract-snapshot.json` — extracted data (FR-INIT-5). */
export const contractSnapshotSchema = z.object({
  generatedAt: z.string(),
  sources: z.array(taintSourceSchema),
});
export type ContractSnapshot = z.infer<typeof contractSnapshotSchema>;
