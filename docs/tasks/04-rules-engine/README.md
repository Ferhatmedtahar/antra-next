# Epic 04: Rule Implementation & Detection

**Status: done.** All four rules, the render graph they query, the sanitizer gate and inline suppressions are live; `scan` reports findings with provenance and real exit codes. On ipractis: 42 findings (40 BG-002, 2 BG-003), zero known false positives after the lexical-provenance rule.

Per [ADR-002](../../adr/0002-schema-optional-ingestion-and-trust-tiers.md), taint propagation (`ast/render-graph.ts`) is a separate pass from boundary classification — rules query the render graph, they don't walk the AST themselves. Suppressions (`E1` in [`docs/c4/system-context.md`](../../c4/system-context.md)) land in this epic, not later — BG-003 in particular is unusable noise without them.

## Tasks

See [`tasks.md`](./tasks.md).
