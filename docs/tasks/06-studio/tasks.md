# Epic 06 Tasks — in order

- [x] **TASK-018s:** API server — `src/studio/server.ts` (`createStudioApp`, `startStudio`, static asset serving with SPA fallback and `resolveAssetsDir` that works both bundled and from source), typed contract in `src/studio/types.ts`, `FindingsStore.filesForScan`. `studio [path] --port --no-open` command.
- [x] **TASK-019s:** SPA scaffold — `vite.config.ts` (root `studio/`, Tailwind plugin, `/api` proxy for HMR dev), `studio/tsconfig.json`, design tokens in `studio/src/styles.css`, `api.ts` client, `hooks.ts` (`useLoad` with a global refresh version, toasts).
- [x] **TASK-020s:** Screens — Overview (boundary strip hero, stats, rule bars, trend line), Findings (filters + drawer with code frame/trace/copy actions), Sources (pin/ignore switches that write the config), Config (rules/keywords/pins/ignores/sanitizers editor with dirty-state save bar), Files, Scans. Sidebar runs scans and records baselines.
- [x] **TASK-021s:** Build pipeline — `pnpm build` = tsup + vite; `typecheck` covers both tsconfigs; eslint type-aware over `studio/`; 6 API tests over the `rules-app` fixture (`tests/unit/studio/server.test.ts`) — 115 total.

- [x] **TASK-022s:** Design system — Poppins (`@fontsource/poppins`, self-hosted), Tabler icons, shadcn/ui components copied into `studio/src/components/ui/` (`radix-ui`, `cva`, `tailwind-merge`, `tw-animate-css`, sonner toasts, `components.json` + `@/` alias so `shadcn add` works), the shadcn oklch theme in `styles.css` with a selected `.dark` palette and a sidebar toggle (persisted, applied before first paint). `SectionHeader` (icon tile + title + description + action) heads every page and card; tables replaced by bordered row lists grouped by table/directory; findings open in a Sheet; baseline confirm is an AlertDialog.

- [x] **TASK-023s:** Graph — `src/ast/boundary-graph.ts` `collectEdges` (renders: JSX tag → declaring file via `collectJsxSinks`; calls-action: imports of `"use server"` modules / inline actions), `ScanResult.edges` + a `graph` phase, `edges` table + `edgesForScan`, `GET /api/scans/:id/graph` (`buildGraph`: nodes = files with an edge or a finding; edges carry crossing + BG-001/003 finding counts by sink component). Studio **Graph** page on React Flow + dagre: render graph (filters: crossings only / with findings / action calls / hide isolated; search; LR/TB; click → neighbour highlight + side panel with findings and in/out edges; deep links from Findings and Files) and a Route tree view of `app/`. Finding sheet shows the trace as a vertical flow.

Not in v1 (candidates for a follow-up):

- `query` command (ad-hoc SQL over `antra-findings.sqlite`) — Studio covers the common questions.
- Screenshot-based visual regression tests.
