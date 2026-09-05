# Epic 08 — Open source readiness

**Status: done.** The repository is presentable to someone who has never seen it: a README that explains the problem before the tool, a licence, contribution and security docs, issue/PR templates, and CI that runs the same checks a contributor runs locally.

## Story

Everything before this epic was built for one developer. Publishing changes the audience: the first thing a stranger reads has to answer "what does this catch, and why can't ESLint do it", and the first pull request has to be checked by something other than trust.

## Scope

- **`README.md`** — the leak in four lines of code, the four rules, a sixty-second start, a Mermaid pipeline diagram, the config reference, suppressions and baseline, a CI recipe, the command table, Studio screenshots, and an honest limits section.
- **`LICENSE`** — MIT, matching `package.json`.
- **`CONTRIBUTING.md`** — setup, the script table, how the layers fit together, how to add a rule or a schema provider, branch and commit conventions.
- **`SECURITY.md`** — what the tool touches (nothing leaves the machine, Studio is localhost-only), private reporting for anything that could execute code or leak a scanned project, and the note that a missed leak is a bug rather than a vulnerability.
- **`.github/`** — `workflows/ci.yml` (format, typecheck, lint, test, build on Node 20 and 22, then a dogfood run of `doctor` and `scan` over `tests/fixtures/rules-app` with the SARIF uploaded as an artifact; commitlint over the PR's commits), three issue forms, and a pull request template.
- **`docs/screenshots/`** — captured from a purpose-built demo app (`app/`, client components, actions, route handlers, a Supabase types file), never from a real project, so no private code ships in the README.
- **`package.json`** — `repository`, `homepage`, `bugs`, `keywords`, `author`, `prepublishOnly: pnpm build`.

## Not in scope

- Publishing to npm (the metadata is ready; the release is a decision, not a task).
- A documentation site. The README plus `docs/` is enough at this size.
