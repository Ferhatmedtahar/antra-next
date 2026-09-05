# Epic 06: Studio — local web dashboard

**Status: done (v1).** `boundary-guard studio` serves a React SPA over the same SQLite file the CLI writes, and edits the same `boundary-guard.config.json` the CLI reads.

## Story

As the developer who runs `boundary-guard` on a project, I want to _see_ what crosses the boundary — with the code frame and the path the value took — and to tune what counts as sensitive (pin a field, ignore a false positive, switch a rule off) without hand-editing JSON, then re-scan from the same screen.

## Decisions

- **Stack:** React 19 + Vite + Tailwind v4 for the SPA (dev-dependencies; prebuilt into `dist/studio/`), Hono + `@hono/node-server` for the API (the only runtime additions). Charts are hand-rolled SVG — one series each, so no chart library.
- **Server is a thin adapter.** Every route calls something that already exists: `FindingsStore`, `loadConfig`/`writeConfig`, `runScan`, `writeBaseline`. No logic lives in `src/studio/server.ts`. The SPA never touches the filesystem.
- **Binds to `127.0.0.1` only.** It can rewrite the project's config and run scans; it is not a network service.
- **Config edits are validated by the same zod schema `init` uses**, so Studio and the CLI can never disagree about the file.
- **Visual identity = the boundary.** Server files carry a cool tint, client files a warm one, everywhere (file badges, the crossing glyph on findings, the Overview hero strip where each flagged crossing is a dot on the seam). Status colours (error/warning/good) are reserved for status. Palette validated with the dataviz script; no categorical chart palette was needed once the status stack became three numbers.

## Screens

| Route                | What it shows                                                                                                                               | What it changes                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/` Overview         | boundary strip, new / baselined / suppressed / sensitive-fields numbers, new findings by rule, trend across scans                           | —                                                                            |
| `/findings` Findings | filter by status, rule, text; drawer with code frame, provenance trace, copy-suppression-comment, fingerprint; `?scan=N` opens an older run | —                                                                            |
| `/sources` Sources   | every snapshot field with _why_ it's sensitive (keyword / pinned / ignored)                                                                 | pin / ignore switches → `sensitiveFields.include/exclude`                    |
| `/config` Config     | rules, keywords, pinned, ignored, sanitizers, providers                                                                                     | all of it; sticky Save bar; server-side validation errors surface as a toast |
| `/files` Files       | server/client classification, actions, route handlers                                                                                       | —                                                                            |
| `/scans` Scans       | every recorded run                                                                                                                          | —                                                                            |
| sidebar              | project, last scan                                                                                                                          | **Run scan**, **Record baseline**                                            |

## API (`src/studio/server.ts`, contract in `src/studio/types.ts`)

`GET /api/project` · `GET /api/rules` · `GET /api/scans` · `GET /api/scans/:id` (findings with code frames + files) · `GET /api/sources` · `GET /api/config` · `PUT /api/config` · `POST /api/scan` · `POST /api/baseline` · `GET *` → SPA (503 with instructions if `dist/studio` isn't built).

## Tasks

See [`tasks.md`](./tasks.md).
