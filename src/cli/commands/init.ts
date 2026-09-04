import chalk from "chalk";

/**
 * `boundary-guard init` — interactive setup wizard.
 *
 * Produces exactly two files and touches nothing else:
 *   1. boundary-guard.config.json           — the user's DECISIONS (which
 *      framework adapter, which schema provider(s), keyword overrides,
 *      sanitizer registry, rule toggles). Human-editable after this runs.
 *   2. .boundary-guard/contract-snapshot.json — the extracted DATA (actual
 *      field names pulled from whatever schema/contract source was picked).
 *      Machine-generated; `sync` regenerates this one, config.json is left
 *      alone.
 *
 * Scope for this command (see docs/tasks/01-init-config-setup/README.md):
 * this is CONFIG-ONLY. No AST parsing, no taint tracking, no rules run here.
 * `init` decides a *strategy* and writes it down — `scan` (Epic 02+) is what
 * actually reads source files.
 *
 * Every provider this file mentions (prisma/openapi/zod/zero-schema) is the
 * SAME interface — SchemaProvider { id, detect(rootDir), extract(rootDir, config) }.
 * "detect" is a cheap filesystem probe ("does schema.prisma exist?"), no
 * prompts involved. "extract" is the real parsing work — for most providers
 * that doesn't exist yet (Epic 03), so this command calls it against a stub
 * that throws NotImplementedError until then. zero-schema's extract() is
 * trivial (always returns []) so it's fully real today.
 */
export function initCommand(): void {
  // ---------------------------------------------------------------------
  // STEP 1 — Framework detection (TASK-018, TASK-019)
  // ---------------------------------------------------------------------
  // Instantiate NextAppRouterAdapter and call adapter.detect(rootDir).
  // rootDir = process.cwd() — remember, this is PER-APP (see README): init
  // always assumes it's being run from inside the one Next.js app to
  // configure, never from a monorepo root.
  //
  // detect() should check: does next.config.{js,ts,mjs} exist? does an
  // app/ directory exist? Both -> true. If false, print a clear error
  // ("this doesn't look like a Next.js App Router project") and exit
  // non-zero. Do NOT continue past this point if detection fails — v1
  // supports nothing else (FR-INIT-1).

  // ---------------------------------------------------------------------
  // STEP 2 — Silent auto-probe for schema providers (TASK-020, TASK-021)
  // ---------------------------------------------------------------------
  // For each known provider (prisma, drizzle, supabase, openapi — NOT
  // zod, see note below), call provider.detect(rootDir). This is a plain
  // filesystem check, no user interaction yet:
  //   - prisma:   does prisma/schema.prisma (or a configurable path) exist?
  //   - drizzle:  does drizzle.config.ts exist?
  //   - supabase: does database.types.ts exist in a common location
  //               (types/, lib/, root)?
  //   - openapi:  does a local openapi.json/swagger.json exist? (a REMOTE
  //               spec URL can never be auto-detected — that's step 4)
  //   - zod:      no reliable filename convention for shared DTOs, skip
  //               auto-detect for v1, only offer it as a manual choice
  //               in step 3.
  //
  // Collect the results: which providers came back detect() === true.
  // Nothing is written or asked yet — this step only gathers candidates.
  //
  // SECONDARY SIGNAL — dependency nudge: also check package.json for
  // @prisma/client / @supabase/supabase-js / @supabase/ssr. If a
  // dependency is present but the matching file wasn't found above,
  // that's a DIFFERENT state than "no schema evidence at all" — don't
  // let it fall through to zero-schema silently. Flag it for step 3 to
  // surface explicitly ("found Supabase as a dependency but no generated
  // types file — want to point me at one, or generate it first?").

  // ---------------------------------------------------------------------
  // STEP 3 — Ask the user what to enable (FR-INIT-2, FR-INIT-3)
  // ---------------------------------------------------------------------
  // For every provider detect() found: confirm ("Found schema.prisma —
  // use it as a data source? [Y/n]").
  // Then offer the full list as a multi-select checkbox prompt (including
  // ones that weren't auto-detected — openapi, zod, and any the user
  // wants to add manually): Prisma / Drizzle / Supabase / OpenAPI / Zod.
  // If the user selects NOTHING, that's fine — zero-schema mode is the
  // implicit floor, never a checkbox item, never blocks completion
  // (FR-INIT-3: "init never refuses to finish for lack of a schema").
  //
  // Library choice: something like @inquirer/prompts (checkbox + confirm
  // + input prompt types) — pick one, keep it consistent with whatever
  // `ora`/`chalk` conventions the rest of the CLI already uses.

  // ---------------------------------------------------------------------
  // STEP 4 — Provider-specific follow-up questions (FR-INIT-4)
  // ---------------------------------------------------------------------
  // For each ENABLED provider that still needs details:
  //   - prisma/drizzle/supabase: if detect() found nothing but the user
  //     enabled it anyway, ask for the file path directly.
  //   - openapi: ALWAYS ask — "Path or URL to your OpenAPI/Swagger spec?"
  //     (can never be auto-filled, even if a local file was detected in
  //     step 2, confirm/override the path here).
  //   - zod: ask for a glob pattern ("Where do your shared Zod schemas
  //     live? e.g. packages/shared/src/**/*.ts").
  //
  // Build up a ProviderConfig per enabled provider: { id, ...whatever
  // that provider needs to run extract() later }.

  // ---------------------------------------------------------------------
  // STEP 5 — Run extraction (TASK-021, FR-INIT-5)
  // ---------------------------------------------------------------------
  // For each enabled provider, call provider.extract(rootDir, config).
  //   - zero-schema always succeeds (returns []).
  //   - prisma/openapi/zod/drizzle/supabase are stubs today — calling
  //     extract() throws NotImplementedError. Catch that specifically and
  //     tell the user plainly: "prisma support lands in a future update —
  //     continuing without it for now" rather than crashing the whole
  //     command. (This is what lets init ship BEFORE Epic 03 exists.)
  // Concatenate whatever TaintSource[] results you did get — enabled
  // providers MERGE, they don't compete. Two providers almost always
  // describe different fields from different origins (Supabase = your
  // own DB, OpenAPI = a separate backend); union their output into one
  // list rather than picking a "winning" provider. If two providers
  // somehow claim the exact same field with different sensitivity, treat
  // it as sensitive if EITHER says so — never silently drop a signal.

  // ---------------------------------------------------------------------
  // STEP 6 — Write the two output files (TASK-022, TASK-023, FR-INIT-6)
  // ---------------------------------------------------------------------
  // Before writing anything: check if boundary-guard.config.json already
  // exists. If it does, ask for confirmation before overwriting
  // (FR-INIT-7 — init must be safely re-runnable, never silently clobber).
  //
  // Write boundary-guard.config.json:
  //   { frameworkAdapter: "nextjs-app-router",
  //     providers: [ProviderConfig, ...],
  //     keywords: { include: [], exclude: [] },   // defaults, user edits later
  //     sanitizers: ["zod", "next-safe-action"],   // recognized out of the box
  //     rules: { "BG-001": true, "BG-002": true, "BG-003": true, "BG-004": true } }
  //
  // Write .boundary-guard/contract-snapshot.json:
  //   { generatedAt: <ISO timestamp>, sources: TaintSource[] }

  // ---------------------------------------------------------------------
  // STEP 7 — Summary output
  // ---------------------------------------------------------------------
  // Print something like:
  //   "✓ boundary-guard initialized"
  //   "  framework: Next.js App Router"
  //   "  providers: prisma (stubbed), zero-schema"
  //   "  config written: boundary-guard.config.json"
  //   "  snapshot written: .boundary-guard/contract-snapshot.json"
  // Reuse the chalk conventions already used elsewhere in src/cli/commands/.

  console.log(chalk.blue.bold("boundary-guard init"));
  console.log(chalk.yellow("Setup wizard not implemented yet."));
}
