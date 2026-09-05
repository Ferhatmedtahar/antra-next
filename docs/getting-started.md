# Getting Started

## Why the empty folders have a `.gitkeep` file

Git only tracks files, never directories. An empty folder — `src/ast/`, `src/schema/`, `src/schema/providers/`, `src/storage/`, `src/reporters/`, `tests/fixtures/components/` — has nothing in it for git to track, so `git add` silently drops it. Anyone who clones the repo would just... not have that folder.

`.gitkeep` is not a git feature — it's a zero-byte file with a name that's become a community convention (`.keep` and `.gitignore`-adjacent tricks also exist). Its only job is to give the empty folder _something_ to track, so the directory shows up after a clone. Once a real file lands in one of these folders (Milestone 1's `src/ast/boundary-classifier.ts`, for example), the `.gitkeep` in that folder becomes dead weight — delete it then, git doesn't need it once there's real content.

## What's built so far (Milestone 0)

Nothing scans anything yet. What exists is the **walking skeleton**: a CLI that boots, parses every flag from the CLI surface spec, and dispatches to 10 commands — but every command body is a placeholder that prints "not implemented yet" and returns. The tooling around it (lint, format, typecheck, tests, git hooks) is real and enforced, not a placeholder.

| Piece                                                                                                                    | State                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm typecheck` / `pnpm lint`                                                 | Real, all green                                                                                                                                                                                                                  |
| `src/cli/index.ts` — commander registration, all 10 commands + flags                                                     | Real                                                                                                                                                                                                                             |
| `init` / `sync` — `src/init/`, `src/framework/`, `src/schema/providers/`, `src/config/`                                  | Real (Epics 01+03): detects Next.js App Router, offers Prisma/Supabase/Drizzle/OpenAPI/Zod, extracts every field into `.boundary-guard/contract-snapshot.json`, seeds `sensitiveFields.include` in `boundary-guard.config.json`. |
| `scan` — `src/engine.ts`, `src/ast/`, `src/classification/`, `src/rules/`, `src/suppressions/`                           | Real (Epics 02–04): classifies every file, resolves taint at every JSX/action/route sink, runs BG-001–004, applies inline suppressions, prints findings with provenance, exits 1 with `--fail-on-violation`.                     |
| `baseline` — `src/baseline/`                                                                                             | Real (Epic 05): records current findings so `scan` only fails on new ones.                                                                                                                                                       |
| `doctor`, `trace`, `watch`, `fix`, `query` — `src/doctor/`, `src/git/`, `src/watch/`, `src/fix/`, `src/storage/query.ts` | Real (Epic 07): health checks, per-line dataflow, read-only SQL over the scan history, save-and-rescan, reasoned suppression comments; `scan --staged` / `--diff` limit the rules to changed files.                              |
| `src/storage/`, `src/reporters/`                                                                                         | Real (Epic 05): every scan appended to `.boundary-guard/findings.sqlite`; `pretty` / `json` / `sarif` reporters.                                                                                                                 |
| Husky pre-commit (lint-staged) + commit-msg (commitlint)                                                                 | Real, enforced on every commit                                                                                                                                                                                                   |
| `tests/unit/smoke.test.ts`, `tests/unit/cli.test.ts`                                                                     | Real — verify the entrypoint loads and every command/flag is registered                                                                                                                                                          |

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

## The rest of the CLI

```bash
boundary-guard scan --staged                 # pre-commit: rules only on staged files (whole project still parsed)
boundary-guard scan --diff --base origin/main   # PR scope: changed since the merge-base, untracked included
boundary-guard doctor                        # 11 checks with a hint each; exit 1 on a ✖
boundary-guard trace app/page.tsx:94         # why is this line flagged — path from origin to sink
boundary-guard query                         # schema + example queries
boundary-guard query "SELECT rule_id, COUNT(*) FROM findings WHERE status='active' GROUP BY 1" --format csv
boundary-guard watch                         # full scan, then rescan whatever you save
boundary-guard fix --suppress BG-002 --reason "validated upstream by middleware" --dry-run
```

Partial scans (`--staged`, `--diff`, `watch`, `trace`) print a `scope:` line and are never recorded in `findings.sqlite`, so Studio's history only holds whole-project runs. `fix` only inserts suppression comments — it picks `//`, `/* */` or `{/* */}` from the surrounding syntax and refuses to run without a `--reason`.

## Studio — the local dashboard

```bash
pnpm build                      # once; builds the CLI and the Studio SPA into dist/
boundary-guard studio           # http://127.0.0.1:8080 opens in your browser (--port, --no-open)
```

Studio reads the same `.boundary-guard/findings.sqlite` every scan writes and edits the same `boundary-guard.config.json` the CLI reads — pin or ignore a field on **Sources**, flip a rule or add a keyword on **Config**, hit **Run scan** in the sidebar and see the effect in **Findings** with the code frame and the path the value took. **Record baseline** does what the CLI command does. It binds to localhost only.

The moon/sun button at the bottom of the sidebar switches between the light and dark themes; the choice is remembered per browser.

Working on Studio itself: `pnpm dev studio <project> --no-open` provides the API on 8080 and `pnpm dev:studio` serves the SPA with hot reload on 5173, proxying `/api`. The UI is React + Tailwind v4 with shadcn/ui components under `studio/src/components/ui/` (add more with `pnpm dlx shadcn@latest add <name>`), Tabler icons, and Poppins bundled from `@fontsource/poppins`.

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
