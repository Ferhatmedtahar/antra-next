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
  keywords: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
  }),
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
