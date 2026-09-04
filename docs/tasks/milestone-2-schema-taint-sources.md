# Milestone 2: Schema & Taint Sources

Scope settled in [ADR-002](../adr/0002-schema-optional-ingestion-and-trust-tiers.md): ingestion must degrade gracefully when there's no local DB schema (BFF / Express / NestJS backends). `SchemaProvider` is the extensibility seam — a new source is a new provider, nothing else changes.

- [ ] **TASK-009:** Create schema provider interface `src/schema/types.ts` (`TaintSource`, `ColumnDefinition`, `SchemaProvider`).
- [ ] **TASK-010:** Implement `src/schema/providers/prisma.ts` to statically parse `.prisma` files and extract model fields (Strategy A).
- [ ] **TASK-011:** Implement keyword heuristic classifier (`password`, `token`, `secret`, `ssn`, `hash`, etc.) with explicit include/exclude overrides (Strategy D — lexical property/prop-name matching, the always-on fallback).
- [ ] **TASK-011a:** Implement `src/schema/providers/openapi.ts` to ingest an OpenAPI/Swagger spec (file or URL) and normalize its schemas to `TaintSource`s (Strategy B).
- [ ] **TASK-011b:** Implement `src/schema/providers/zod.ts` to statically resolve shared `z.object(...)` DTO declarations to `TaintSource`s (Strategy C).
- [ ] **TASK-011c:** Implement server-ingress tracking: mark the return of `fetch`/`axios`/known SDK calls inside Server Components as tainted-by-default until explicitly projected. Feeds Rule BG-003 (`docs/tasks/milestone-3-rules.md`) — needs no field-level sensitivity data, so it's the fallback that works even with zero schema.
