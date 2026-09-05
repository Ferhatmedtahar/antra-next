# Epic 05 Tasks — in order

- [x] **TASK-015:** `src/storage/db.ts` — `FindingsStore` over `.boundary-guard/findings.sqlite` (better-sqlite3, WAL). Tables: `scans` (one row per run: timing, framework, rules, counts), `files` (every classification), `taint_sources` (every schema field + sensitive flag), `findings` (every finding with status `active` / `suppressed` / `baselined`, relative path, trace, fingerprint, suppression reason). `runScan` appends each scan unless `store: false` / `--no-store`; a write failure (read-only CI checkout) is reported on the result, never fatal. Ignored by the `.gitignore` block `init` writes.
- [x] **TASK-016:** `src/reporters/terminal.ts` — summary (with duration and capped lists) then findings grouped by file: `line:col  severity  RULE  message`, a code frame (±1 line, sink underlined with `^`), the provenance trace, baselined/suppressed counts. Colour via a `Chalk` instance so it's off for `--output` and in tests.
- [x] **TASK-017:** `src/reporters/sarif.ts` — SARIF 2.1.0: tool + rule metadata from the registry, relative URIs against `%SRCROOT%`, `partialFingerprints`, `properties.trace`; suppressed findings carry `suppressions: [{ kind: "inSource", justification }]`, baselined ones `baselineState: "unchanged"`. Exit codes: `--fail-on-violation` → 1 on any new finding; `--strict` → also 1 when the project was never `init`-ed; unknown `--format`/`--rule` → 2. Verified by `tests/unit/cli/scan-command.test.ts`.
- [x] **Baseline** (E1 in `docs/c4`, the adoption path): `src/baseline/baseline.ts` — every finding gets a fingerprint (`rule + relative file + sink text` + ordinal; line numbers excluded so unrelated edits don't create "new" findings). `boundary-guard baseline` records the current active set to `.boundary-guard/baseline.json` (commit it); `scan` then reports only findings not in it. `ignoreBaseline` in the engine is what `baseline` itself uses.

Landed alongside:

- [x] Reporter registry `src/reporters/index.ts` (`pretty` | `json` | `sarif`) — `--format` picks one, `--output <file>` writes it (any format) and prints a one-line confirmation. `json` is the verbatim `ScanResult`.
- [x] `ScanResult` gained `startedAt`, `durationMs`, `baselined`, `scanId`, `storeError`; `scan` output moved out of the command into the reporter (the command only picks a reporter and sets the exit code).
- [x] 16 new tests — `storage/db`, `baseline/baseline` (fingerprint stability + end to end), `reporters/reporters` (terminal frames, json, sarif shape), `cli/scan-command` (exit codes, `--output`, `--no-store`). 109 total.

Deferred to their own epics: `query` and `studio` (both read `findings.sqlite` — the next epic), `watch`, `doctor`, `trace`, `fix`, and the `--diff`/`--staged` flags (parsed, not implemented).
