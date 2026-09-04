# ADR-002: Schema-Optional Ingestion via Trust-Tiered Taint Sources

## Status

Accepted

## Date

2026-09-04

## Context

ADR-001 assumed a monolithic Next.js app talking directly to its own database, with `schema.prisma` as the source of truth for which fields are sensitive. That assumption breaks in the architecture most real deployments actually use — Next.js as a **Backend-For-Frontend (BFF)**:

```
[ Browser ] -- React Flight boundary --> [ Next.js Server Components / BFF ] -- internal network --> [ Express / NestJS / Go / external APIs ] --> [ Database ]
```

Here there is no `schema.prisma` in the Next.js repo. Data arrives via `fetch()`/`axios`/an SDK, typed (if at all) with hand-written interfaces, `as` casts, or `any`. Since TypeScript types are erased at runtime, they cannot be trusted as a security boundary: `const user = (await res.json()) as PublicUser` proves nothing about what's actually in the object — the backend can add `internal_role` tomorrow and the cast silently lies.

This ADR settles two questions before implementation goes further: what the engine can actually treat as ground truth when there is no schema, and how that changes the pipeline in `docs/c4/system-context.md`.

## Decision

### Trust hierarchy

Static analysis can rank evidence, not eliminate uncertainty. We use three tiers:

1. **Absolute truth — AST syntax the bundler itself enforces.** `"use client"` / `"use server"` directives, JSX attribute names, `PropertyAccessExpression`s (`data.password_hash`), `process.env.*` reads. These can't lie without breaking the app.
2. **Strong contracts — runtime-validated schemas.** Zod/Valibot schemas, OpenAPI/Swagger specs from a NestJS/Express backend. Trusted because a mismatch fails at runtime, not just at compile time.
3. **Weak / not trusted for security proofs.** Plain `interface`/`type` declarations, `as` assertions, comments. Ingested only as a fallback signal (e.g. to name a field in a finding), never as the basis for "this is safe."

### Four ingestion strategies, degrading gracefully

`providers/` (ADR-001's extensibility seam, Layer 1) implements, in order of preference: **(A)** local DB/Prisma, **(B)** OpenAPI/Swagger ingestion from a backend, **(C)** shared Zod/DTO schemas, **(D)** zero-schema pure-AST heuristics. `init` tries A→C and falls back to D — the tool never refuses to run for lack of a schema.

### What Strategy D (zero-schema) actually checks

Without a schema, the engine can't know _which_ fields are sensitive, so it substitutes two heuristics that don't require that knowledge:

- **Lexical property/prop-name matching** (`.password`, `.token`, `.ssn`, JSX attrs named the same) — a keyword blocklist against AST identifiers, independent of declared types.
- **Server-ingress tracking** — the return value of `fetch()`/`axios`/SDK calls inside a Server Component is marked tainted-by-default until explicitly projected. This backs **Rule BG-003 (opaque object pass)**: `<UserProfile user={user} />` is flagged whenever `user` traces back to an ingress call and reaches the boundary as a bare identifier rather than a destructured/explicit set of fields — regardless of whether any individual field is known to be sensitive. This is the highest-value rule in schema-optional mode precisely because it needs no sensitivity classification at all.

### Pipeline changes this forces (see `docs/c4/system-context.md`)

- Taint propagation through assignment/destructuring/JSX composition is pulled out into its own component, `ast/render-graph.ts` (`P1` in the diagram), separate from boundary classification (`C2`). They were previously implied to be one step; they are not — classifying a file as Server/Client tells you nothing about whether a given binding is tainted.
- `Suppressions & Baseline Filter` (`E1`) is drawn explicitly between the rules engine and storage, matching `engine.ts`'s actual sequencing (`applySuppressions` runs before `persist`). This is load-bearing, not cosmetic: heuristic rules in schema-optional mode will false-positive on legitimate code, and without suppressions + `baseline` available from the first release, the tool is too noisy to adopt on an existing codebase.

## Consequences

### Positive

- The tool has a real answer to "we don't use Prisma" / "our backend is NestJS" instead of falling back to "unsupported" — degrades to heuristics rather than refusing to run.
- `SchemaProvider` (ADR-001, Layer 1) already anticipated this: OpenAPI/Zod ingestion is a new provider implementation, not a new architectural concept.
- BG-003 gives useful signal in the _worst-information_ case (no schema, no types) without needing per-field sensitivity data, which is otherwise the hardest problem this tool has.

### Negative

- **Lexical heuristics are a recall problem, not just a config problem.** A field named `pwd`, `secretNote`, or anything in a non-English or non-conventional vocabulary will not match a keyword list. This is not fixable by adding more keywords — it's a structural limit of name-based matching, already acknowledged in ADR-001 as "Heuristic False Negatives" and unchanged by this ADR.
- **Taint propagation scope is bounded, not sound.** Full interprocedural dataflow through arbitrary control flow (`{...user}` spreads, `Object.assign`, passing through several function calls, state stores, `Promise` chains held across renders) is the same class of problem CodeQL/Semgrep solve with dedicated dataflow-analysis frameworks. `ts-morph` gives an AST and a type checker, not a dataflow engine — building unbounded soundness on top of it is out of scope. V1's `render-graph.ts` tracks taint **within a function/module and one hop through named imports/exports**; anything that escapes that scope is a documented false negative, not a bug to chase.
- **BG-003 trades recall for precision risk.** Flagging every bare opaque-object prop will catch real leaks but will also flag already-safe DTOs that just aren't destructured at the call site. This is why the Suppressions & Baseline Filter is mandatory infrastructure for v1, not a later milestone — without it, BG-003 in particular is unusable on any real codebase.
- **Ingress tracking only sees Server Components/Actions/`route.ts` that this repo's AST can reach.** If the "backend" is a separate repo, the engine has no way to correlate `fetch('https://api.internal/users')`'s actual response shape with anything — Strategy D treats the whole response as opaque, which is correct but coarse; Strategy B (OpenAPI ingestion) is the only way to get field-level precision for cross-repo backends, and requires the operator to point `boundary-guard` at a spec file or URL during `init`.

## Alternatives Considered

- **Full whole-program interprocedural taint analysis** (CodeQL/Semgrep-style dataflow graph across the entire call graph, including through state managers and network round-trips).
  - _Rejected for v1 because:_ this is a multi-year research-grade engineering effort on its own, and the ADR-001 thesis is a fast, zero-infrastructure static linter, not a dataflow-analysis framework. Bounded (same-module + one-hop) propagation plus the opaque-object heuristic (BG-003) covers the highest-value cases — an unprojected object crossing the boundary — without requiring full soundness.
- **Refusing to run without a recognized schema provider.**
  - _Rejected because:_ this excludes the BFF/Express/NestJS architecture, which is the common case, not the edge case, in production Next.js deployments. Degrading to heuristics is strictly better than an unsupported-project error.
