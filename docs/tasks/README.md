# Tasks

Working backlog for `boundary-guard`, broken into epics — one folder each, in build order. Each epic folder has a `README.md` (story, scope, functional requirements) and a `tasks.md` (ordered checklist). Work one task at a time, one branch per task — see [`docs/process/git-workflow.md`](../process/git-workflow.md) for the branching/commit/merge conventions.

- [00-scaffolding/](./00-scaffolding/) — repo scaffolding & walking skeleton — **done**
- [01-init-config-setup/](./01-init-config-setup/) — `init`: framework + schema-provider detection, config/snapshot files — **done**
- [02-boundary-detection/](./02-boundary-detection/) — AST boundary classification (Server/Client/Action/Route) — **done**
- [03-schema-taint-sources/](./03-schema-taint-sources/) — real schema provider implementations + zero-schema heuristics — **done**
- [04-rules-engine/](./04-rules-engine/) — render graph (taint propagation), BG-001–004 rules, sanitizers, suppressions — **done**
- [05-storage-reporting-ci/](./05-storage-reporting-ci/) — SQLite storage, terminal/SARIF reporters, baseline — **next**

See [`docs/adr/`](../adr/) for accepted architectural decisions and [`docs/c4/`](../c4/) for the settled system diagram.
