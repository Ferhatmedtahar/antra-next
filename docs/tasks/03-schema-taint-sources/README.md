# Epic 03: Schema & Taint Sources

**Status: done** (Prisma, Supabase, Drizzle, OpenAPI, Zod all extract for real; keyword classifier; `sync`). Open: TASK-011c moved to Epic 04 (it's render-graph work), TASK-011e (Supabase schema straight from `.env` keys via PostgREST) optional.

Scope settled in [ADR-002](../../adr/0002-schema-optional-ingestion-and-trust-tiers.md): ingestion must degrade gracefully when there's no local DB schema (BFF / Express / NestJS backends). `SchemaProvider` is the extensibility seam — a new source is a new provider, nothing else changes.

This epic fills in the real `extract()` bodies for the providers Epic 01 (`init`) already knows how to detect and offer, plus the always-on lexical/ingress heuristics that back zero-schema mode.

## Tasks

See [`tasks.md`](./tasks.md).
