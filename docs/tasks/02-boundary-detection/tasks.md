# Epic 02 Tasks — in order

- [x] **TASK-006:** Test fixtures in `tests/fixtures/components/`:
  - `ClientCard.tsx` (`"use client"`), `ServerPage.tsx` (Server Component rendering `ClientCard`, with an inline `"use server"` function), `actions.ts` (module-level `"use server"`, one non-exported helper), `route.ts` (exports `POST`/`PUT`/`PATCH`/`DELETE`, plus a non-exported helper).
  - Extra negatives: `handlers.ts` (exports `POST` but isn't `route.ts` → not a handler), `lib.ts` (plain server module).
- [x] **TASK-007:** `src/ast/boundary-classifier.ts` (Next.js App Router conventions, syntax only — never types):
  - `isClientBoundary(sourceFile)` — `"use client"` in the directive prologue (leading string-literal statements only; a directive after an import doesn't count).
  - `isServerAction(node)` — body opens with `"use server"`, **or** the node is exported from a module that opens with `"use server"`. Accepts `FunctionDeclaration | ArrowFunction | FunctionExpression`; handles `export default`, `export { fn }`, and `export const fn = async () => {}`.
  - `isRouteHandler(sourceFile)` / `routeHandlerMethods(sourceFile)` — basename `route.ts|js|mjs` exporting at least one of `GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS` (resolves `export { POST }` too; `route.tsx` deliberately rejected).
  - Also: `isServerActionModule`, `hasDirective`, `listServerActions` (includes actions nested inside components), and `classifyFile(sourceFile): FileClassification` — the per-file record `C2` hands to `P1` later.
  - `src/ast/project.ts` — `loadProject(rootDir)`: one ts-morph `Project` over every `.ts/.tsx/.js/.jsx` under the root, minus `node_modules/.next/dist/build/out/coverage` and `.d.ts`; uses the target's `tsconfig.json` for compiler options (path aliases) when present, falls back to sane defaults otherwise.
- [x] **TASK-008:** `tests/unit/ast/boundary-classifier.test.ts` — 16 tests: every fixture's classification, plus in-memory edge cases (single-quoted directive, leading comment, directive after import, directive string inside a body, multiple directives, default-exported arrow action, `export { fn }`, expression-bodied arrow, `export { POST }`, `route.ts` with no verbs, `route.tsx`).

Landed alongside, so Epic 02 is runnable rather than library-only:

- [x] `src/engine.ts` — `runScan({ rootDir })`: detect framework → `loadProject` → `classifyFile` per file. The single sequencing point from `docs/c4`; later epics extend it, commands never sequence steps themselves.
- [x] `src/framework/detect.ts` — `detectFramework` / `requireFramework` / `FrameworkNotDetectedError`, moved out of `init/` so `engine.ts` doesn't depend on the init flow.
- [x] `scan [path] --format json|pretty` now runs the engine and prints counts + per-file client boundaries, server actions (`file:line name`), and route handlers (`[methods]`). Exits 1 on a non-Next.js target. Says plainly that rules/taint tracking aren't wired yet.
- [x] `tests/unit/engine.test.ts` — end-to-end on a temp Next.js project: `node_modules`/`.next` excluded, every file classified correctly.
