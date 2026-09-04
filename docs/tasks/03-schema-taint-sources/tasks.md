# Epic 03 Tasks — in order

- [ ] **TASK-009:** Create schema provider interface `src/schema/types.ts` (`TaintSource`, `ColumnDefinition`, `SchemaProvider` — extended in Epic 01/TASK-020 with `detect()`/`extract()` signatures; this task is the original type definitions).
- [ ] **TASK-010:** Implement `src/schema/providers/prisma.ts` to statically parse `.prisma` files and extract model fields (Strategy A). Replaces the Epic 01 stub's `NotImplementedError`.
- [ ] **TASK-011:** Implement keyword heuristic classifier (`password`, `token`, `secret`, `ssn`, `hash`, etc.) with explicit include/exclude overrides (Strategy D — lexical property/prop-name matching, the always-on fallback).
- [ ] **TASK-011a:** Implement `src/schema/providers/openapi.ts` to ingest an OpenAPI/Swagger spec (file or URL) and normalize its schemas to `TaintSource`s (Strategy B). Replaces the Epic 01 stub.
- [ ] **TASK-011b:** Implement `src/schema/providers/zod.ts` to statically resolve shared `z.object(...)` DTO declarations to `TaintSource`s (Strategy C). Replaces the Epic 01 stub.
- [ ] **TASK-011c:** Implement server-ingress tracking: mark the return of `fetch`/`axios`/known SDK calls inside Server Components as tainted-by-default until explicitly projected. Feeds Rule BG-003 (Epic 04) — needs no field-level sensitivity data, so it's the fallback that works even with zero schema.
- [ ] **TASK-011d:** Implement `src/schema/providers/drizzle.ts` and `src/schema/providers/supabase.ts` (Option A's other members — Drizzle `pgTable(...)` declarations, Supabase-generated `database.types.ts`). Not blocking Epic 04; add once Prisma/OpenAPI/Zod prove the provider pattern out.
