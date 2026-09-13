# Antra web: landing page + docs site

Date: 2026-09-08
Status: approved, moving to implementation plan

## Context

`antra` (rebranding to "Antra") is a static-analysis security linter for
React Server Components / the Next.js App Router. It needs a public landing page
and a docs site. A design import exists at `designai/` (Claude Design export,
`Antra Landing.dc.html` + `Antra Docs.dc.html`, design system "Modernist" at
`designai/_ds/modernist-.../`). The mockup's copy describes a generic
multi-scanner security tool (secrets, dependency, infra, Docker, Kubernetes
scanning; four severity levels; an AI chat feature in "Studio"). None of that
exists in the real product. The real product does exactly one thing: AST-based
taint tracking across React Flight (server → client) boundaries, with
schema-aware sensitive-field detection. This spec ports the mockup's visual
design and structural patterns but replaces all product-claim copy with content
grounded in the actual CLI (`src/cli/index.ts`), rule set (`src/rules/bg-*.ts`),
and config schema (`src/config/types.ts`).

## Goals

- `apps/web`: Next.js 16 (App Router) + React 19 + Tailwind v4, added as a new
  pnpm workspace member. Root CLI package and `studio/` are untouched.
- Landing page ported from `Antra Landing.dc.html`, minus the interactive
  "Live demo" (`#scan`) section, with product-claim copy corrected to reality.
- `/docs` subsystem: sidebar + TOC + prev/next, MDX content under
  `content/docs/**`, nav generated from the folder tree (not hand-maintained).
- Visual design ports the "Modernist" system: Archivo (headings/body), IBM Plex
  Mono (code), blue accent scale (`#1a47ff`), radius 0, light/dark toggle.
- No hardcoded brand/link strings scattered through components — centralized in
  `apps/web/config/site.ts` (name, tagline, GitHub URL placeholder, nav links).
- Docs command examples use `antra` (forward-looking to the pending CLI rename)
  but with the _real_ command/flag surface — not invented flags.

## Non-goals

- Renaming the actual `antra` package/bin to `antra` (explicitly out of
  scope — user will do this separately).
- Migrating `studio/` to Next.js or extracting a shared `packages/ui` (only one
  new app exists; premature).
- Turborepo / build-pipeline tooling (plain pnpm workspaces are sufficient at
  this scale).
- Search, i18n, versioned docs, analytics.

## Workspace layout

```
apps/
  web/                       # new: landing + docs (Next.js 16)
studio/                      # unchanged
src/                         # unchanged (CLI package, stays at repo root)
```

`pnpm-workspace.yaml` already includes `apps/*`. Root `package.json` gains
`dev:web` / `build:web` scripts that `pnpm --filter web ...`. `apps/web` owns
its own `package.json`, `tsconfig.json`, `eslint.config.mjs` (extending the
root's rules where practical), and `tailwind` config via CSS `@theme` (Tailwind
v4 has no required JS config file).

## apps/web structure

```
apps/web/
  app/
    layout.tsx                     # fonts, ThemeProvider, root <html>
    globals.css                    # @theme tokens ported from Modernist
    (marketing)/
      page.tsx                     # composes modules/landing sections
    docs/
      [[...slug]]/page.tsx         # resolves slug -> content/docs/**/*.mdx
      layout.tsx                   # sidebar + main + TOC shell
  modules/
    landing/
      landing.tsx                  # orders sections
      sections/
        hero/hero.tsx
        before-you-push/before-you-push.tsx
        how-it-works/how-it-works.tsx
        checks/checks.tsx
        scope/scope.tsx            # "does / does not"
        workflow/workflow.tsx
        cta/cta.tsx
    docs/
      sidebar.tsx
      toc.tsx
      pager.tsx                    # prev/next
      mdx-components.tsx           # heading, Note, Tabs, CodeBlock -> mdx scope
      get-nav.ts                   # reads content/docs at build time -> tree
  components/
    shared/
      nav-bar.tsx, footer.tsx, theme-toggle.tsx, button.tsx,
      code-block.tsx, tabs.tsx, note.tsx, terminal.tsx
  content/
    docs/
      getting-started/{introduction,installation,quick-start,configuration-basics}.mdx
      concepts/{trust-boundaries,findings-and-severity,schema-providers,suppressions-and-baselines}.mdx
      commands/{init,scan,sync,doctor,baseline,trace,watch,fix,query,studio}.mdx
      studio/{introduction,launching,reading-the-graph}.mdx
      configuration/config-reference.mdx
      rules/{bg-001,bg-002,bg-003,bg-004}.mdx
      ci/github-actions.mdx
  config/
    site.ts                        # name, tagline, githubUrl, navLinks
  lib/
    theme.ts
  public/
    fonts (or Google Fonts <link>, matching mockup's @import approach)
```

Each doc `.mdx` file carries frontmatter (`title`, `group`, `order`) that
`get-nav.ts` reads to build the sidebar tree — the tree is derived, not
duplicated in a second hand-maintained array.

## Visual design (ported from Modernist)

Tailwind v4 `@theme` block in `globals.css`, values taken from
`designai/_ds/.../styles.css` and the mockup's inline accent override:

- `--font-heading`, `--font-body`: Archivo (400/600/800)
- `--font-mono`: IBM Plex Mono
- Accent scale: `#1a47ff` family (100–900), replacing the DS default orange
- Neutral scale, `--radius-*: 0`, shadow tokens, divider token — all as in
  `styles.css`
- Light/dark: same token-swap approach as the mockup's `applyTheme()` (dark bg
  `#1a1918`), toggled via a small client component, persisted to
  `localStorage`, no flash-of-wrong-theme (inline script in `<head>` reads
  storage before paint)
- Component patterns ported as Tailwind utility combinations, not copied CSS
  classes: numbered grid strips, bordered section grid, terminal block, tag/
  note/card patterns

## Landing page content

Sections, in order, each its own module folder:

1. **Nav** — brand, "How it works", GitHub (from `site.ts`), theme toggle,
   "Docs", "Get Started" → `/docs/getting-started/quick-start`
2. **Hero** — headline ("Catch security issues before they cross the
   boundary"), static illustrative terminal block (non-interactive — just
   example output, not a claim of a live demo), primary/secondary CTAs
3. **Before you push** — unchanged narrative + 5-step strip (unchanged, no
   product claims)
4. **How it works** — Scan → Detect → Understand → Fix (matches the real
   scan → findings → Studio-explains → `fix` pipeline)
5. **Checks** (rewritten) — real coverage only: React Flight boundary
   analysis, schema-aware sensitive-field detection (provider list: Prisma,
   Zod, Supabase, OpenAPI, Drizzle), taint tracking, sanitizer-aware
   suppression. No secrets/deps/infra/Docker/K8s tiles.
6. **Scope** ("Antra does / does not") — rewritten: does static RSC/App
   Router boundary analysis, schema-aware detection, CI gating via SARIF;
   does not do dependency scanning, infra scanning, or replace pen testing /
   production monitoring
7. **Workflow + integrations** — GitHub Actions example using real flags
   (`antra scan --format sarif --fail-on-violation`); integrations grid
   trimmed to GitHub + generic CI/CD (Docker/K8s tiles removed — no backing
   feature)
8. **CTA** — unchanged pattern, links to `/docs`
9. **Footer** — links from `site.ts`

The "Live demo" (`#scan`, typed-animation terminal with a "Run scan again"
button) is removed entirely per instruction.

## Docs content (grounded)

Nav groups and real source of truth per group:

| Group           | Pages                                                                                 | Source                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Getting Started | introduction, installation, quick-start, configuration-basics                         | product framing + `src/cli/commands/init.ts`                                                             |
| Core Concepts   | trust-boundaries, findings-and-severity, schema-providers, suppressions-and-baselines | `src/rules/*`, `src/schema/*`, `src/config/types.ts`                                                     |
| Commands        | one page per real command                                                             | `src/cli/index.ts` (verbatim flags below)                                                                |
| Antra Studio    | introduction, launching, reading-the-graph                                            | `src/studio/**`, `studio/src/pages/*` (Overview, Graph, Files, triage panel — no fictional chat feature) |
| Configuration   | config-reference                                                                      | `src/config/types.ts` (`antraConfigSchema`)                                                              |
| Rules           | BG-001..BG-004                                                                        | `src/rules/bg-00{1..4}.ts` descriptions                                                                  |
| CI              | github-actions                                                                        | real `scan` flags                                                                                        |

Real command surface, authoritative for the Commands pages (name shown as
`antra` per your call, flags copied verbatim from `src/cli/index.ts`):

- `init [path]` — initialize config, introspect DB, generate schema snapshot
- `scan [path]` — `-s/--strict`, `--diff`, `--staged`, `--base <ref>`,
  `--fail-on-violation`, `--format pretty|json|sarif`, `--rule <ruleId>`,
  `--verbose`, `--output <file>`, `--no-store`
- `sync [path]` — refresh schema snapshot from DB/Prisma/Supabase
- `doctor [path]` — `--format pretty|json`
- `baseline [path]` — record current violations as accepted
- `trace <target> [path]` — `--format pretty|json`
- `watch [path]` — `--full`, `--rule <ruleId>`
- `fix [path]` — `--suppress <rule>`, `--reason <text>`, `--file <fragment>`,
  `--dry-run`
- `query [sql] [path]` — `--format table|json|csv`
- `studio [path]` — `--port <port>` (default 8080, localhost only), `--no-open`

Real rules (from `src/rules/bg-*.ts`):

- `BG-001` (error) — sensitive value passed to a Client Component from the
  server
- `BG-002` (error) — [full description to be read from `src/rules/bg-002.ts`
  at authoring time; truncated in this pass]
- `BG-003` (warning) — unprojected fetch/DB result passed whole to a Client
  Component
- `BG-004` (error) — sensitive value rendered directly into markup

Real config schema (`antra.config.json`, `antraConfigSchema`
in `src/config/types.ts`): `version: 1`, `frameworkAdapter`, `providers[]`
(each with `id`), `keywords.{include,exclude}`,
`sensitiveFields.{include,exclude}`, `sanitizers[]`, `rules: Record<string,
boolean>`.

Content authoring reads the cited source files directly rather than
paraphrasing this spec — this spec fixes structure and facts, not final prose.

## Testing / build

- `apps/web` gets its own `tsconfig.json` (Next's recommended strict config)
  and is added to the root `typecheck` script alongside the existing CLI/studio
  checks.
- `pnpm --filter web build` must succeed (Next build) as the completion bar —
  no unit tests planned for marketing copy; MDX content is not
  type-checked beyond frontmatter shape (a small zod schema for frontmatter,
  validated in `get-nav.ts`).
- Manual verification: run `pnpm --filter web dev`, check landing + a sample of
  docs pages in light and dark mode.

## Open items for the implementation plan

- Exact copy for `BG-002`'s description (read full file, not just the grep
  snippet).
- Exact real feature list of Studio's UI (read `studio/src/pages/*.tsx`) for
  the "reading-the-graph" doc page — must not reuse mockup's fictional Q&A
  chat framing.
- Provider list for schema-aware detection: confirm current provider IDs in
  `src/schema/providers/*` before naming them in the "Checks" section and
  "schema-providers" concept page.
