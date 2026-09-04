# Epic 02: Boundary Detection Engine

**Status: not started.**

Lives in `src/ast/` (renamed from `src/analyzer/` to match the settled folder structure: `project.ts` wraps the ts-morph `Project`, `boundary-classifier.ts` does what's below, `render-graph.ts` is taint propagation and lands in Epic 04 alongside the rules that consume it).

Classifies every source file against the `FrameworkAdapter`'s conventions (Epic 01) — for `NextAppRouterAdapter` today, that means `"use client"`, `"use server"`, and `route.ts` handlers.

## Tasks

See [`tasks.md`](./tasks.md).
