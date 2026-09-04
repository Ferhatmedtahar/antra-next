import type { SchemaProvider } from "../types.js";
import { openapiProvider } from "./openapi.js";
import { prismaProvider } from "./prisma.js";
import { supabaseProvider } from "./supabase.js";
import { zodProvider } from "./zod.js";

export { zeroSchemaProvider } from "./zero-schema.js";

/**
 * Providers `init` offers in its checkbox, in suggestion order (ADR-002
 * A→C). zero-schema is deliberately not here — it's always on, never a
 * choice. Adding a provider = adding one entry; nothing in `init` changes.
 */
export const selectableProviders: readonly SchemaProvider[] = [
  prismaProvider,
  supabaseProvider,
  openapiProvider,
  zodProvider,
];
