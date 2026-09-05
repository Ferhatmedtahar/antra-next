# Contributing

Thanks for looking. The most useful contributions, in order: a false positive or false negative with the snippet that caused it, a schema provider for something we don't read yet, a rule, docs.

## Setup

```bash
git clone https://github.com/Ferhatmedtahar/boundary-guard.git
cd boundary-guard
pnpm install
pnpm test
```

Node 20 or newer, pnpm (the version is pinned in `package.json`; corepack or pnpm itself will fetch it).

| Script            | Does                                                       |
| ----------------- | ---------------------------------------------------------- |
| `pnpm dev <cmd>`  | Run the CLI from source: `pnpm dev scan ../some-next-app`. |
| `pnpm test`       | Vitest, unit + fixture projects under `tests/fixtures/`.   |
| `pnpm typecheck`  | Both tsconfigs (CLI and Studio).                           |
| `pnpm lint`       | ESLint, type-aware.                                        |
| `pnpm format`     | Prettier.                                                  |
| `pnpm build`      | tsup for the CLI, Vite for the Studio, into `dist/`.       |
| `pnpm dev:studio` | Studio with hot reload on 5173, proxying `/api` to 8080.   |

CI runs format check, typecheck, lint, tests and a build on every pull request.

## How the code is laid out

`src/engine.ts` is the only place the scan pipeline is sequenced. Everything else is a layer it calls:

```
framework/   detect the framework (Next.js App Router today)
schema/      providers that extract fields — Prisma, Supabase, Drizzle, OpenAPI, Zod
classification/  which fields are sensitive; which calls are sanitizers
ast/         ts-morph project, boundary classifier, render graph, taint resolver
rules/       BG-001 … BG-004, one file each
suppressions/ baseline/ storage/ reporters/   what happens to findings
cli/         thin commands — parse flags, call the engine, print
studio/      the Hono API; the React app lives in studio/
```

Design decisions live in `docs/adr/`; the diagram in `docs/c4/`; the backlog and what each epic did in `docs/tasks/`.

## Adding a rule

1. `src/rules/bg-00X.ts` exporting a `Rule` (`id`, `severity`, `description`, `run(file, ctx)`). Rules query the render graph through `ctx.resolver` and `collectJsxSinks`; they don't walk the AST themselves.
2. Register it in `src/rules/index.ts` — the runner, reporters, Studio and `--rule` pick it up from there.
3. Plant a sink in `tests/fixtures/rules-app/` and assert on it in `tests/unit/rules/`.

## Adding a schema provider

1. `src/schema/providers/<id>.ts` implementing `SchemaProvider`: `detect(rootDir)`, `configFields()` (what `init` asks for), `extract(rootDir, config)` returning `{ field, origin }[]` with origins like `prisma:User.passwordHash`.
2. Add it to `selectableProviders` in `src/schema/providers/index.ts`.
3. A fixture under `tests/fixtures/schemas/` and a test in `tests/unit/schema/`.

## Branches and commits

One branch per task off `main`, squash-merged. Commit messages follow Conventional Commits and are checked by commitlint on commit (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`, `ci:`, `perf:`). `pnpm commit` walks you through it. Details in [`docs/process/git-workflow.md`](./docs/process/git-workflow.md).

## Reporting a false positive

Open an issue with the "False positive" template: the finding line as printed, the snippet, and what the value actually is. If you can reduce it to a file in `tests/fixtures/`, even better.
