# Antra — agent guidance

Antra is an open source static analysis security scanner for React Server
Components and the Next.js App Router. It finds the point where sensitive
server-side data crosses into the client without validation. Published as
`@ferhattahar/antra-next` on npm; the binary is `antra`.

## Layout

- `src/` — the engine and CLI. Rules in `src/rules/bg-00N.ts`, schema providers
  in `src/schema/providers/`, AST work in `src/ast/`, storage in `src/storage/`.
- `apps/studio/` — the local Studio web UI (React, Vite, wouter, Tailwind).
- `apps/web/` — the public docs site (Next.js App Router, MDX).
- `docs/` — architecture notes, ADRs, and specs. `docs/superpowers/specs/`
  holds the design doc for each feature; read the relevant one before changing
  a feature's behaviour.

## Invariants

- `src/studio/types.ts` is the browser-facing API contract. It imports nothing
  from the engine — the browser bundle type-checks against it alone, and the
  server maps engine types onto its shapes so TypeScript verifies they fit.
  Never add an engine import to it.
- `src/studio/prompt.ts`, `src/studio/rule-guidance.ts`, and
  `src/utils/package-manager.ts` run in the browser. None may import `node:fs`
  or `node:path`.
- The engine's `TraceStep` (`src/rules/types.ts`) and the Studio's `TraceStep`
  (`src/studio/types.ts`) are separate types. Frames are a read-time projection
  in the server, not persisted.
- Rule prose lives in **two** places that must stay in step:
  `src/studio/rule-guidance.ts` (what the Studio sheet and the fix prompt show)
  and `apps/web/content/docs/rules/bg-00N.mdx` (what the docs site shows).
  Changing a rule's meaning means changing both.

## Commands

- `pnpm test` — vitest, node environment, `tests/**/*.test.ts`
- `pnpm typecheck` — `tsc --noEmit` for the engine, then for the Studio
- `pnpm lint` — eslint
- `pnpm build` — tsup for the CLI, then vite for the Studio
- `pnpm --filter web build` — the docs site (not part of `pnpm build`)

Do not add a suppression comment to silence a real taint flow in this repo's
own code. Fix the flow.
