# Getting Started

## Why the empty folders have a `.gitkeep` file

Git only tracks files, never directories. An empty folder — `src/ast/`, `src/schema/`, `src/schema/providers/`, `src/storage/`, `src/reporters/`, `tests/fixtures/components/` — has nothing in it for git to track, so `git add` silently drops it. Anyone who clones the repo would just... not have that folder.

`.gitkeep` is not a git feature — it's a zero-byte file with a name that's become a community convention (`.keep` and `.gitignore`-adjacent tricks also exist). Its only job is to give the empty folder _something_ to track, so the directory shows up after a clone. Once a real file lands in one of these folders (Milestone 1's `src/ast/boundary-classifier.ts`, for example), the `.gitkeep` in that folder becomes dead weight — delete it then, git doesn't need it once there's real content.

## What's built so far (Milestone 0)

Nothing scans anything yet. What exists is the **walking skeleton**: a CLI that boots, parses every flag from the CLI surface spec, and dispatches to 10 commands — but every command body is a placeholder that prints "not implemented yet" and returns. The tooling around it (lint, format, typecheck, tests, git hooks) is real and enforced, not a placeholder.

| Piece                                                                                                                        | State                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint`                                                     | Real, all green                                                                                                                                                                                                   |
| `src/cli/index.ts` — commander registration, all 10 commands + flags                                                         | Real                                                                                                                                                                                                              |
| `init` — `src/init/run-init.ts` + `src/framework/` + `src/schema/providers/` + `src/config/`                                 | Real (Epic 01): detects Next.js App Router, offers schema providers, writes `boundary-guard.config.json` + `.boundary-guard/contract-snapshot.json`. Provider `extract()` parsing is still stubbed until Epic 03. |
| `src/cli/commands/*.ts` other than `init` (`scan`, `sync`, `doctor`, `baseline`, `trace`, `watch`, `fix`, `query`, `studio`) | Placeholder bodies — parse args, print a message, do nothing else                                                                                                                                                 |
| `src/ast/`, `src/storage/`, `src/reporters/`                                                                                 | Empty — this is where Epics 02–05 land                                                                                                                                                                            |
| Husky pre-commit (lint-staged) + commit-msg (commitlint)                                                                     | Real, enforced on every commit                                                                                                                                                                                    |
| `tests/unit/smoke.test.ts`, `tests/unit/cli.test.ts`                                                                         | Real — verify the entrypoint loads and every command/flag is registered                                                                                                                                           |

Architecture decisions are recorded in [`docs/adr/`](./adr/); the settled system diagram is [`docs/c4/system-context.md`](./c4/system-context.md); the task backlog is [`docs/tasks/`](./tasks/).

## Running it inside this repo (fastest — use this while developing)

No build step. `tsx` runs the TypeScript source directly.

```bash
pnpm dev --help
pnpm dev scan .
pnpm dev scan /path/to/some/other/project --strict --format json
```

`pnpm dev` is just `tsx src/cli/index.ts` (see `package.json`) — anything after `pnpm dev` is passed straight through to the CLI, including a path to a project that isn't this repo. This is how you'll iterate day to day: edit `src/`, rerun `pnpm dev scan <target>`, no build in between.

## Running the packaged CLI (what it'll feel like installed)

```bash
pnpm build                              # compiles src/ -> dist/ via tsup
node bin/boundary-guard.js --help
node bin/boundary-guard.js scan /path/to/other/project
```

`bin/boundary-guard.js` is the real npm `bin` entrypoint — it imports the built `dist/cli/index.js` and calls `program.parse()`. This is what runs when the package is actually installed somewhere. **You must `pnpm build` again after every source change** — unlike `pnpm dev`, this path doesn't re-transpile on the fly.

## Testing it against a real project, as a real `boundary-guard` command

Two options, both verified working:

### Option A — `pnpm link` (recommended for repeated testing)

From the **other** project you want to scan:

```bash
cd /path/to/other-project
pnpm link /home/ferhat/Desktop/boundary-guard    # symlinks it into node_modules
pnpm exec boundary-guard scan .                   # or: ./node_modules/.bin/boundary-guard scan .
```

Remember to `pnpm build` in `boundary-guard/` first, and again after every change you want reflected — the link points at `dist/`, not `src/`.

To undo it:

```bash
cd /path/to/other-project
pnpm uninstall boundary-guard
```

### Option B — absolute path, zero setup

```bash
cd /path/to/other-project
node /home/ferhat/Desktop/boundary-guard/bin/boundary-guard.js scan .
```

No linking, no install, works from anywhere. Best for a one-off check; Option A is nicer if you're testing repeatedly since `boundary-guard scan .` is shorter than the full path every time.

Either way, right now every command just confirms flags were parsed correctly — `scan` won't find anything because the AST engine (Milestone 1+) doesn't exist yet.

## Running the test suite

```bash
pnpm test          # runs once (vitest run)
pnpm test:watch    # reruns on file change
```

Two files today:

- `tests/unit/smoke.test.ts` — the package entrypoint (`src/index.ts`) loads and exports what's expected.
- `tests/unit/cli.test.ts` — every command from the CLI surface spec is registered on `program`, and `scan` exposes its documented flags (`--strict`, `--diff`, `--staged`, `--fail-on-violation`, `--format`, `--rule`).

## Full verification loop

What you should run before committing (this is also what `pre-commit`/CI will eventually enforce):

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
```

## Git hooks already wired up

- **`pre-commit`** runs `lint-staged` — eslint `--fix` + prettier on whatever you staged. It can modify your staged files; review the diff after a commit.
- **`commit-msg`** runs `commitlint` — enforces [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.). A commit message that doesn't match gets rejected.
- Don't want to hand-write a conventional commit message? Run `pnpm commit` instead of `git commit` — it launches an interactive prompt (Commitizen) that builds one for you.

## What's next

`init` ([Epic 01](./tasks/01-init-config-setup/)) is next up — it doesn't scan anything, it just decides and persists which framework/schema-provider strategy applies. `scan` starts doing real work once [Epic 02](./tasks/02-boundary-detection/) lands (`isClientBoundary`, `isServerAction`, `isRouteHandler` in `src/ast/boundary-classifier.ts`). Until then, this walking skeleton is the whole product — every later epic plugs into the CLI layer and `engine.ts` sequencing described in `docs/c4/` without touching what's documented here.
