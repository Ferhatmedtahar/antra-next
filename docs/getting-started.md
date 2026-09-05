# Getting Started

## Why the empty folders have a `.gitkeep` file

Git only tracks files, never directories. An empty folder — `src/ast/`, `src/schema/`, `src/schema/providers/`, `src/storage/`, `src/reporters/`, `tests/fixtures/components/` — has nothing in it for git to track, so `git add` silently drops it. Anyone who clones the repo would just... not have that folder.

`.gitkeep` is not a git feature — it's a zero-byte file with a name that's become a community convention (`.keep` and `.gitignore`-adjacent tricks also exist). Its only job is to give the empty folder _something_ to track, so the directory shows up after a clone. Once a real file lands in one of these folders (Milestone 1's `src/ast/boundary-classifier.ts`, for example), the `.gitkeep` in that folder becomes dead weight — delete it then, git doesn't need it once there's real content.

## What's built so far (Milestone 0)

Nothing scans anything yet. What exists is the **walking skeleton**: a CLI that boots, parses every flag from the CLI surface spec, and dispatches to 10 commands — but every command body is a placeholder that prints "not implemented yet" and returns. The tooling around it (lint, format, typecheck, tests, git hooks) is real and enforced, not a placeholder.

| Piece                                                                                          | State                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint`                       | Real, all green                                                                                                                                                                                                                  |
| `src/cli/index.ts` — commander registration, all 10 commands + flags                           | Real                                                                                                                                                                                                                             |
| `init` / `sync` — `src/init/`, `src/framework/`, `src/schema/providers/`, `src/config/`        | Real (Epics 01+03): detects Next.js App Router, offers Prisma/Supabase/Drizzle/OpenAPI/Zod, extracts every field into `.boundary-guard/contract-snapshot.json`, seeds `sensitiveFields.include` in `boundary-guard.config.json`. |
| `scan` — `src/engine.ts`, `src/ast/`, `src/classification/`, `src/rules/`, `src/suppressions/` | Real (Epics 02–04): classifies every file, resolves taint at every JSX/action/route sink, runs BG-001–004, applies inline suppressions, prints findings with provenance, exits 1 with `--fail-on-violation`.                     |
| `baseline` — `src/baseline/`                                                                   | Real (Epic 05): records current findings so `scan` only fails on new ones.                                                                                                                                                       |
| `doctor`, `trace`, `watch`, `fix`, `query`, `studio`                                           | Placeholder bodies — parse args, print a message, do nothing else                                                                                                                                                                |
| `src/storage/`, `src/reporters/`                                                               | Real (Epic 05): every scan appended to `.boundary-guard/findings.sqlite`; `pretty` / `json` / `sarif` reporters.                                                                                                                 |
| Husky pre-commit (lint-staged) + commit-msg (commitlint)                                       | Real, enforced on every commit                                                                                                                                                                                                   |
| `tests/unit/smoke.test.ts`, `tests/unit/cli.test.ts`                                           | Real — verify the entrypoint loads and every command/flag is registered                                                                                                                                                          |

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

Either way, `scan` loads the target project, classifies every file, and runs the rules. Useful flags: `--rule BG-003` (one rule), `--fail-on-violation` (exit 1 on any finding — the CI gate), `--strict` (also fails when the project was never `init`-ed), `--verbose` / `--format json` (everything). Suppress a finding you've reviewed with a comment on the line above it:

```text
{/* boundary-guard-disable-next-line BG-001 reason="public share token, not a secret" */}
<ShareButton token={link.share_token} />
```

Commands other than `init`/`sync`/`scan` still just confirm their flags were parsed.

## Tuning which fields count as sensitive

The snapshot (`.boundary-guard/contract-snapshot.json`) stores **every** field your providers found — no sensitivity flag. Which ones are treated as taint origins is decided at scan time from `boundary-guard.config.json`. `init` seeds `sensitiveFields.include` with whatever the default keywords flagged, so the config file _is_ the list — read it, add to it, and edits take effect on the next `scan` with no `sync` (`sync` refreshes the snapshot and never rewrites your config):

```jsonc
"keywords": { "include": ["password", "token", "mot_de_passe", "iban"] },
"sensitiveFields": {
  "include": ["supabase:public.tutors.salary", "kennwort"],   // pin: always sensitive
  "exclude": ["source_hash", "supabase:public.docs.checksum"] // never sensitive
}
```

- **`keywords.include`** — name patterns, any language. ≥4 chars match as a substring (`token` catches `accessToken`); ≤3 chars match whole words only (`ssn` doesn't fire inside `previous_snapshot`).
- **`sensitiveFields.include`** — exact field name (case/separator-insensitive) or exact origin. Seeded by `init`; add what keywords can't know: your language, your domain (`iban`, `salary`). Removing an entry here does **not** un-flag it if a keyword still matches — use `sensitiveFields.exclude` for that.
- **`sensitiveFields.exclude`** — same matching, wins over everything. The one way to say "never". For the false positives substring matching buys (`source_hash`).

`sync` and `init` print the full current list, so the loop is: run `sync`, read the list, pin or ignore, `scan`.

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

[Epic 01](./tasks/01-init-config-setup/) (`init`) and [Epic 02](./tasks/02-boundary-detection/) (`src/ast/boundary-classifier.ts`, `src/engine.ts`) are done. Next is [Epic 03](./tasks/03-schema-taint-sources/): real `extract()` bodies for the schema providers plus the zero-schema heuristics, so the snapshot stops being empty and `scan` has taint sources to work with. Everything later plugs into `engine.ts`'s `runScan()` without touching what's documented here.

## Adopting on an existing codebase, and gating CI

An existing project will have findings on day one. Don't fix them all before you can turn the gate on — record them:

```bash
boundary-guard baseline        # writes .boundary-guard/baseline.json — commit it
boundary-guard scan            # now reports only findings that aren't in the baseline
```

Findings are matched by a fingerprint of rule + file + sink text (not line numbers), so unrelated edits don't resurrect them. Re-run `baseline` when you've deliberately accepted more; fix a baselined finding and it simply stops appearing.

CI gate — every scan exits 1 on a new finding with `--fail-on-violation`, and SARIF plugs straight into GitHub code scanning:

```yaml
- run: pnpm exec boundary-guard scan --format sarif --output boundary-guard.sarif --fail-on-violation
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: boundary-guard.sarif
```

Suppressed findings are included in the SARIF with `suppressions`, so the platform hides them itself. Every scan is also appended to `.boundary-guard/findings.sqlite` (gitignored) — `--no-store` skips that.
