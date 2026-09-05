# Epic 05: Storage, Reporting & CI

**Status: done.** Every scan is recorded in SQLite; `pretty` / `json` / `sarif` reporters; `baseline` for adoption; real CI exit codes. Studio (reading the same SQLite file) is the next epic.

Findings land in SQLite once (`storage/`); every reporter (`terminal`, `sarif`, the future Studio dashboard) reads from that one file rather than re-deriving anything, per [`docs/c4/system-context.md`](../../c4/system-context.md).

## Tasks

See [`tasks.md`](./tasks.md).
