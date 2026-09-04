# Epic 02 Tasks — in order

- [ ] **TASK-006:** Create test fixtures in `tests/fixtures/components/`:
  - `ClientCard.tsx` (has `"use client"` directive).
  - `ServerPage.tsx` (standard Server Component rendering `ClientCard`).
  - `actions.ts` (has `"use server"` directive).
  - `route.ts` (exports `POST`/`PUT`/`PATCH`/`DELETE` — third sink type, backs Rule BG-003 in Epic 04, not folded into BG-002).
- [ ] **TASK-007:** Implement `src/ast/boundary-classifier.ts` using `ts-morph` to inspect ASTs and identify:
  - `isClientBoundary(sourceFile: SourceFile): boolean`
  - `isServerAction(node: FunctionDeclaration | ArrowFunction): boolean`
  - `isRouteHandler(sourceFile: SourceFile): boolean` — `route.ts` exporting an HTTP-verb function.
- [ ] **TASK-008:** Write Vitest unit tests verifying accurate boundary identification on test fixtures.
