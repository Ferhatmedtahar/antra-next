# Epic 07 — The rest of the CLI

**Status: done.** Every command the CLI surface spec registered as a placeholder now does its job: `doctor`, `trace`, `query`, `watch`, `fix`, and the `--diff` / `--staged` scan flags.

## Story

The scan pipeline, storage and Studio exist. What's missing is the day-to-day glue: a fast pre-commit scan that only looks at what's staged, a health check when something's off, a way to ask "why is this line flagged", ad-hoc questions over the scan history, a save-and-rescan loop, and a mechanical way to accept a batch of findings with a recorded reason.

## Scope

- **`scan --staged` / `--diff [--base <ref>]`** — rules run only on the changed files (`git diff --cached` / merge-base with the base branch plus untracked files). The whole project is still parsed so cross-file taint resolves. Partial scans are labelled in the report and never recorded in `antra-findings.sqlite`.
- **`doctor [path] [--format json]`** — eleven checks with a hint each: Node version, framework, config validity, provider files, snapshot presence/staleness, sensitive-field count, rule toggles, baseline, `.gitignore` block, `antra-findings.sqlite`, parser. Exit 1 on any failed check; warnings (zero-schema mode, no baseline) don't fail.
- **`trace <file[:line]> [path] [--format json]`** — scans with the rules limited to that file and prints every finding at the location (new / accepted / suppressed) with the code frame and the dataflow path, origin first.
- **`query [sql] [path] [--format table|json|csv]`** — read-only SQL over `antra-findings.sqlite`; no SQL prints the schema and example queries.
- **`watch [path] [--full] [--rule]`** — full scan on start, then `fs.watch` (recursive, debounced) rescans the saved files; config/snapshot/baseline changes or `--full` rescan everything. Nothing is recorded.
- **`fix [path] --suppress <rule|all> --reason <text> [--file <fragment>] [--dry-run]`** — inserts `antra-disable-next-line` comments above every new finding of the rule, choosing `//`, `/* */` or `{/* */}` from the surrounding syntax. Validator scaffolding (BG-002) and prop projection (BG-003) are explicitly not automated — they need the data's shape.

## Not in scope

- Incremental parsing between watch runs (every rescan rebuilds the ts-morph project; fine below ~1k files).
- `fix` for anything that changes program behaviour.
