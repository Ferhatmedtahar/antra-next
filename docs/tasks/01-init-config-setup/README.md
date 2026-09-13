# Epic 01: `init` — Interactive Config Setup

**Status: done.** `init` runs end to end. Provider `extract()` bodies (real Prisma/Supabase/OpenAPI/Zod parsing) are deliberately still stubs — that's Epic 03; until then `init` reports them as skipped and writes an empty snapshot.

## Story

As a developer adding `antra` to a Next.js App Router project, I run `antra init` once so the tool knows which framework conventions apply and which data source(s) to trust as taint origins — without hand-writing JSON myself.

## Scope decided during design (see chat/ADR references below)

- **Config-only.** `init` decides and persists a _strategy_ — which framework adapter, which schema provider(s), what config each needs. It does not implement the real scanning/taint engine; that's Epics 02–04. Where a provider's real `extract()` logic doesn't exist yet (Prisma/OpenAPI/Zod parsing lands in Epic 03), `init` uses a stub that's honest about being unimplemented rather than faking a result.
- **Schema providers are multi-select**, not single-choice. A project can have local Prisma _and_ call an external OpenAPI-described service at once — forcing one primary provider would be wrong for that case.
- **Multiple enabled providers merge, they don't compete.** Each enabled provider's `TaintSource[]` output gets unioned into one list — they almost always describe different fields from different origins (Supabase describes your own DB, OpenAPI describes a separate backend), not two conflicting answers about the same field. ADR-002's "priority order A→D" governs what `init` auto-detects/suggests first and what it nudges toward before offering zero-schema — it does not mean one provider's data overrides another's once both are enabled. If two providers do disagree about the exact same field, treat it as sensitive if _either_ says so — false negatives are worse than false positives for a security tool.
- **A missing schema file isn't automatically zero-schema.** If a known ORM/service dependency is present in `package.json` (`@supabase/supabase-js`, `@prisma/client`, ...) but its schema/types file isn't found at the default location, `init` says so explicitly and offers a custom path, instead of silently falling through to zero-schema. Zero-schema is the floor for "no evidence of a schema-backed source at all," not for "found the dependency but not the file."
- **Monorepo scope: per-app.** `init` always targets exactly one Next.js app (the directory it's run from). A provider's file search may still walk outside that directory to find something like `packages/db/schema.prisma` — but the config and scan target are always scoped to one app. No root-aware multi-app orchestration.
- **Zero-schema (`Option D`) is always implicitly available**, never something the user explicitly picks — it's the floor every project has even with nothing else configured.
- **No live database credentials, ever, in this flow** (ADR-001, NFR3). Live Postgres-catalog introspection, if it's ever added, is a separate opt-in path, not part of the default `init` flow.

Full reasoning: [ADR-002](../../adr/0002-schema-optional-ingestion-and-trust-tiers.md), [`docs/c4/system-context.md`](../../c4/system-context.md).

## Functional requirements

- **FR-INIT-1:** Detect whether the current directory is a Next.js App Router project (`next.config.*` + `app/` present). If not, exit with a clear, actionable error — v1 supports nothing else.
- **FR-INIT-2:** Auto-detect candidate schema providers by filesystem presence: `schema.prisma` (Prisma), a Drizzle config file, `database.types.ts` (Supabase generated types), `openapi.json`/`swagger.json` (OpenAPI). Each detected candidate is offered to the user, not silently assumed. Additionally check `package.json` dependencies (`@prisma/client`, `@supabase/supabase-js`/`@supabase/ssr`) as a secondary signal — if a dependency is present but its schema/types file isn't found at the default location, surface that explicitly (e.g. "found Supabase but no generated types file — run `supabase gen types typescript ...` or point me at one") rather than treating it the same as "no evidence of a schema source at all."
- **FR-INIT-3:** Prompt the user to multi-select which detected provider(s) to enable — multiple can be enabled at once, their extracted fields merge (see "Multiple enabled providers merge" above). If none are detected, ask whether they have an OpenAPI spec (file path or URL) or a shared Zod schema location to point at manually. Only fall back to zero-schema mode once both auto-detection and the dependency nudge (FR-INIT-2) come up empty and the user declines to point at anything manually — `init` never refuses to finish for lack of a schema, but it also never gives up on a schema-backed source too eagerly.
- **FR-INIT-4:** For each enabled provider, prompt for any provider-specific config it needs (e.g. a non-default `schema.prisma` path, an OpenAPI file path or URL, a glob for shared Zod DTOs).
- **FR-INIT-5:** Run each enabled provider's `extract()` once and write the resulting `TaintSource[]` to `.antra/contract-snapshot.json`.
- **FR-INIT-6:** Write `antra.config.json`: framework adapter id, enabled provider ids + their config, default sensitivity keyword list (with room for user include/exclude overrides later), default rule toggles (BG-001–004 on), default sanitizer registry (Zod, `next-safe-action` recognized out of the box).
- **FR-INIT-7:** Idempotent. Re-running `init` on an already-configured project asks for confirmation before overwriting — never silently clobbers an existing config.
- **FR-INIT-8:** No step in this flow requires a live database connection or credentials.

## Tasks

See [`tasks.md`](./tasks.md).
