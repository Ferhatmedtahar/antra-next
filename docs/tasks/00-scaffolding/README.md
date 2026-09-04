# Epic 00: Project Scaffolding & Walking Skeleton

**Status: done.**

Repo tooling, CLI skeleton (all 10 commands registered, placeholder bodies), test runner, git hooks. No scanning logic — see `docs/getting-started.md` for what's real vs. placeholder today.

## Tasks

- [x] **TASK-001:** Initialize `package.json` with `pnpm`, configure ESM (`"type": "module"`), and add scripts: `dev`, `build`, `test`, `typecheck`.
- [x] **TASK-002:** Create `tsconfig.json` (strict, `NodeNext`, ES2022) and `tsup.config.ts` (ESM entrypoints for `src/cli/index.ts` and `src/index.ts`).
- [x] **TASK-003:** Create the core folder structure (`src/cli`, `src/ast`, `src/schema`, `src/storage`, `src/reporters`, `tests/fixtures`, `docs/adr`).
- [x] **TASK-004:** Implement `bin/boundary-guard.js` and `src/cli/index.ts` with `commander` supporting `--version`, `--help`, and a placeholder `scan` command.
- [x] **TASK-005:** Configure `vitest` and create `tests/unit/smoke.test.ts` to ensure the test runner passes green.

Also landed as part of this epic (not in the original backlog, but needed for a solid start):

- [x] ESLint flat config (`eslint.config.mjs`) with `typescript-eslint` + `eslint-config-prettier`.
- [x] Prettier (`.prettierrc`, `.prettierignore`) + `.editorconfig`.
- [x] Husky + lint-staged pre-commit hook (lint + format staged files).
- [x] Commitlint + Commitizen (`commit-msg` hook, Conventional Commits, `pnpm commit`).
- [x] ADR-001 recorded (`docs/adr/0001-static-source-level-analysis.md`).
- [x] CLI restructured to `src/cli/commands/*.ts` (thin wrappers) + `src/cli/index.ts` (registration only), all 10 commands from the CLI surface spec, `program` exported testable.
