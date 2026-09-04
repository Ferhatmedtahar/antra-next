# Git Workflow

## Branching model: trunk-based, no permanent `dev`

`main` is always the latest working state. There is no permanent long-lived `dev`/`develop` branch — that's GitFlow, built for coordinating parallel release trains across a team. This project is single-maintainer-paced right now; a permanent `dev` branch would just be a merge to remember, with no corresponding benefit. Revisit if there's ever a real release cadence that needs protecting `main` from.

Don't commit directly to `main` beyond a trivial docs fix. Every task/feature/fix gets its own short-lived branch off `main`, merged back, then deleted. Branch lifetime = however long the task takes — ideally under a few days. If a branch is still open after a week, it's probably hiding a task that should've been split.

## Branch naming

`<type>/<short-description>`, `<type>` matching the commitlint `type-enum` already configured in `commitlint.config.js` (`feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `build`, `ci`, `perf`, `revert`):

```
feat/init-framework-adapter
feat/bg-001-prop-leak-rule
fix/eslint-project-service-scope
docs/git-workflow
```

Match the branch's `type/` prefix to the commit type(s) you'll use inside it — keeps `git log --oneline main..HEAD` legible before merge, and makes the squash-merge message (below) fall out naturally.

## Workflow per task

1. `git checkout main && git pull` (once a remote exists).
2. `git checkout -b feat/<task-slug>` — one task from `docs/tasks/` per branch. Don't bundle unrelated tasks onto one branch; don't split one task across several.
3. Commit as you go. `pnpm commit` launches the interactive Commitizen prompt if you want help wording a Conventional Commit; plain `git commit` works too if you already know the message. `pre-commit` (lint-staged) and `commit-msg` (commitlint) hooks run either way — see `docs/getting-started.md`.
4. Before merging, run the full verification loop:
   ```bash
   pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
   ```
5. Merge to `main` (see strategy below), then delete the branch — local now, remote too once one exists.

## Merge strategy: squash, by default

Squash-merge every branch into one commit on `main`. Reasons:

- `main`'s history stays one line per feature/fix — easy to scan, easy to `git revert` cleanly if a whole task needs undoing.
- The squash commit message doubles as the Conventional Commit entry for that feature; messy or exploratory commits on the feature branch never need cleaning up first.
- Matches the task-per-branch model above — one task, one line in history.

Reach for a regular (non-squash) merge only when a branch's individual commits are independently meaningful and worth preserving as separate history entries. Rare at this stage; default to squash unless you have a specific reason not to.

## Tags / releases

Not relevant yet — nothing is published. When `boundary-guard` starts shipping to npm, tag releases (`v0.1.0`, ...) off `main` and reconsider whether a tool like Changesets (already used in the ipractis reference repo this project's tooling was modeled on) is worth adding. Don't wire that up before there's a first release to cut — it's dead process until then.

## Where things stand right now

No remote exists yet, and `main` has **zero commits** — everything from Milestone 0 through this session is still staged. Practical adjustment: get an initial commit onto `main` first, then start branching per-task from there. Branching before `main` has anything on it just adds ceremony with nothing to branch from.
