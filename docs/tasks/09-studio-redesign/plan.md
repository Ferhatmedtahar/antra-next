# Studio redesign — "The Seam"

Handoff plan. Everything an implementing agent needs: diagnosis, design direction,
token values, component specs, page wireframes, sweep checklist, verification.

Read this whole file before touching code. Work the phases in order — phase 1
(tokens) is load-bearing for everything after it.

---

## 0. Brief

**Product.** `antra` Studio: the local web dashboard for a static-analysis
linter that finds server → client boundary violations in the Next.js App Router.

**Audience.** Next.js developers, running `antra studio` on localhost,
usually mid-task, usually in dark mode, usually next to a terminal.

**Job.** Answer three questions fast: _did anything cross the boundary?_ _what
crossed?_ _is it new or already accepted?_

**The complaint.** The current build works but reads as a generated SaaS dashboard:
a saturated indigo used as chrome, four identical stat cards in a row, an icon tile
above every heading, borders on everything. Owner wants a distinct identity, the
ipractis design vocabulary (buttons, inputs, colour ramps, type scale), a display
face (Cal Sans / `fontCal`), filled icons, and the mini-cards and filter bar rebuilt.

---

## 1. Diagnosis — what is actually wrong, with receipts

| #   | Problem                                                                                                                                                                                                                                      | Where                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `--primary` is a saturated indigo (`oklch(0.424 0.199 265.638)`) and is used as **chrome**: sidebar logo tile, every `SectionHeader` icon tile, the whole server slab, rule badges, bars, trend line. Colour that means nothing, everywhere. | `styles.css`, `section-header.tsx:69`, `charts.tsx:41`, `shared.tsx:113` |
| 2   | Four identical rounded/bordered/shadowed cards in a 4-up grid — the textbook generated-dashboard shape.                                                                                                                                      | `Overview.tsx:112-149`, `shared.tsx:StatCard`                            |
| 3   | `SectionHeader`'s tinted icon tile is applied to _every_ heading regardless of level. It decorates; it encodes nothing.                                                                                                                      | `section-header.tsx`, used 8× in `shared.tsx`, 11× in `Overview.tsx`     |
| 4   | Borders define every surface: `border-r` on sidebar, `border` on `Card`, `ListPanel`, `StatCard`, `Empty`.                                                                                                                                   | `App.tsx:184`, `card.tsx:11`, `shared.tsx:137`                           |
| 5   | Middle-dot meta soup: `Scan #1 · Sep 5, 2026, 6:23 AM · 14.3 s · BG-001, BG-002, BG-003, BG-004`.                                                                                                                                            | `Overview.tsx:96-101`, `Findings.tsx:145-152`                            |
| 6   | `Open findings →` — arrow glyph appended to button text.                                                                                                                                                                                     | `Overview.tsx:106`                                                       |
| 7   | Findings filter bar is one undifferentiated row: shadcn `TabsList` grey pill + outlined `ToggleGroup` + bordered `Input`, three different border treatments touching.                                                                        | `Findings.tsx:167-215`                                                   |
| 8   | "Sensitive fields — 0 / 0 — Taint origins among the schema fields" is a stat card that is not a stat; it is context for the boundary, stranded in a grid.                                                                                    | `Overview.tsx:136-148`                                                   |
| 9   | Poppins carries every role. Geometric sans at every size = generic. `--font-mono` is declared in the theme but **JetBrains Mono is never loaded**, so all the file paths fall back to system mono.                                           | `styles.css:82`, `main.tsx`                                              |

Items 5 and 6 are on the standard list of generated-UI tells. They go.

---

## 2. Design direction — "The Seam"

The product is about a **boundary**. That is the only visual idea the UI needs, and
it is one no other dashboard has, because no other dashboard is about this.

Everything derives from two territories and the line between them:

- **Server** — the trusted side. Solid, dense, filled. A slab.
- **Client** — the exposed side. Open, hatched, see-through.
- **The seam** — the line. Neutral when nothing crossed. **Red when something did.**

That last sentence is the whole hero: the boundary strip _states the answer_ before
you read a number.

### Colour

**Rule: saturated colour means status. Never chrome.** This single rule fixes the
screenshot. The indigo goes away entirely as a brand colour.

- Brand / primary action = **near-black on light, near-white on dark** (ipractis
  `bg-black text-white` primary). Buttons stop competing with findings.
- **Red** = a violation crossed. **Orange** = warning severity. **Green** = clean.
  **Yellow** = one job only, the "no config — run init" nudge in the sidebar.
- Accepted and suppressed findings **lose their colour** — they have been dealt
  with, they should recede. Currently `soft-success` green for suppressed reads as
  "good news", which is wrong; suppressed is neutral.
- **Blue (`#1A47FF`) survives in exactly two places**: the focus ring and text
  links. Same discipline as ipractis (`--ring: tertiary-500`).

Neutrals shift from cool blue-grey to **warm graphite / warm paper** (ipractis
`primary` + `secondary` ramps). Light mode background is `#FBFAF8`, not white.

### Type

Three faces, three real jobs — no decorative roles.

| Face               | Role                                            | Why                                                                                                   |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Cal Sans**       | page titles, card titles, the big tally numbers | The display personality. Tight, tall x-height, slightly quirky. Owner asked for `fontCal`.            |
| **Inter**          | all body, labels, hints, buttons                | Boring on purpose. Carries no personality so Cal Sans can.                                            |
| **JetBrains Mono** | file paths, rule IDs, code frames, snippets     | ~60% of this UI's content **is code**. Mono here is honest, not a decorative small-label affectation. |

Poppins is removed. Cal Sans + Poppins would be two round geometrics fighting.

**Banned outright:** tracked-out ALL-CAPS eyebrow labels; `→` inside button text;
middle-dot meta strings. Page subtitles become **plain English sentences**
("Ran Sep 5 at 6:23 AM. Took 14.3 s across 4 rules.").

### Layout

Two structural moves:

**a) The four stat cards become one funnel list.** New → Accepted → Suppressed is
literally the lifecycle of a finding. So draw it as a lifecycle: a vertical list,
numbers in a fixed left column (aligned, therefore comparable — a 4-up grid
actively prevents comparison), joined by a thin left rail. The rail is structure
that encodes real information, not decoration. No box per item, no icon tile, no
border. "Sensitive fields" leaves the group — it is boundary context, so it moves
into the boundary strip's caption.

**b) The icon tile dies.** Card titles are just type. A bare 16px filled icon
inline, muted, only where it aids scanning. Icons keep their tile in exactly one
place — the sidebar nav — where scanning is the whole point.

### Motion

One orchestrated moment: after a scan completes, the crossing dots land on the seam,
staggered ~40ms. Nothing else animates on mount. `prefers-reduced-motion` already
handled in `styles.css` base layer — keep it.

---

## 3. Self-review against generic defaults

Checked before building, per the frontend-design process:

| Generic default                                                          | Verdict                                                                                                                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cream + serif display + terracotta accent                                | Not used.                                                                                                                                                                  |
| Near-black + one acid accent                                             | Near-black yes (correct for a dev tool beside a terminal) but there is no single decorative accent — colour is semantic-only and there are two neutral zone tones. Passes. |
| Broadsheet hairlines, 0 radius                                           | Opposite direction: borders removed, radii 10–24px.                                                                                                                        |
| SaaS card kit (identical cards, one radius, same soft shadow)            | This is the brief. Demolished in §2a.                                                                                                                                      |
| ALL-CAPS eyebrows / `A · B · C` / `→` in buttons / mono for small labels | First three banned. Mono is kept **only for content that is genuinely code** — justified above, not a free pass.                                                           |

**Revised during review:** the first pass gave the server zone a colour and the
client zone a lighter tint of the same colour, which collapses in dark mode and
re-introduces decorative colour. Changed to **material contrast** — solid fill vs.
hatched field — which survives both themes and needs no hue at all.

---

## Phase 0 — dependencies (verify first)

`npm` was unreachable in the planning sandbox. **Verify each package resolves before
adding it.**

```
pnpm remove @fontsource/poppins
pnpm add -D @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```

**Cal Sans.** Try `pnpm add -D @fontsource/cal-sans`. If it 404s, self-host — this
is the safer path anyway, because Studio is an offline localhost tool and must never
reach a font CDN:

1. Grab `CalSans-SemiBold.woff2` from the official Cal Sans repo (SIL OFL).
2. Put it at `studio/src/fonts/CalSans-SemiBold.woff2` — Vite's root is `studio/`,
   so a relative `url()` from `styles.css` gets hashed and bundled.
3. Declare it in `styles.css`:

```css
@font-face {
  font-family: "Cal Sans";
  src: url("./fonts/CalSans-SemiBold.woff2") format("woff2");
  font-weight: 600;
  font-display: swap;
}
```

`main.tsx`: drop the four Poppins imports, add the Inter + JetBrains Mono imports.

Filled icons: `@tabler/icons-react` already ships `IconXFilled` variants. Use them
for status/severity glyphs and sidebar nav. Keep outline icons for neutral affordances
(chevrons, close, search) — filling _everything_ muddies the row scan.

---

## Phase 1 — tokens (`studio/src/styles.css`)

Keystone. Rewrite `:root`, `.dark`, and `@theme inline`. Keep the shadcn token names
so the `ui/*` primitives keep compiling; change what they point at.

### Ramps to add (`@theme inline`, ipractis-derived)

```css
/* neutral — warm graphite / warm paper */
--color-ink-100: #1c1c1e;
--color-ink-200: #2c2c2e;
--color-ink-300: #3a3a3c;
--color-ink-400: #48484a;
--color-ink-500: #636366;
--color-ink-600: #8e8e93;
--color-ink-700: #aeaeb2;
--color-ink-800: #c7c7cc;
--color-ink-900: #d1d1d6;
--color-ink-1000: #e5e5ea;
--color-ink-1100: #f2f2f7;
--color-ink-1200: #ffffff;

/* paper — warm surfaces for light mode */
--color-paper-900: #eae9e6;
--color-paper-1000: #f1f0ed;
--color-paper-1100: #f7f6f2;
--color-paper-1200: #fbfaf8;

/* danger */
--color-danger-400: #d6000e;
--color-danger-700: #ff525d;
/* warn   */
--color-warn-300: #cf5826;
--color-warn-600: #ff9264;
/* good   */
--color-good-300: #00ad30;
--color-good-600: #37d67a;
/* nudge  */
--color-nudge-300: #ad9200;
--color-nudge-700: #ffe352;
/* link   */
--color-link-500: #1a47ff;
--color-link-600: #4166ff;
```

> **Note on `good`.** ipractis' success ramp is neon (`#00FF47`) and fails contrast
> as text on either background. `#00AD30` / `#37D67A` are the damped substitutes.
> Deliberate deviation — do not "restore" the neon values.

### Radii — adopt the ipractis scale

```css
--radius-icon: 10px;
--radius-mid: 12px;
--radius-big: 16px;
--radius-huge: 24px;
```

Buttons and inputs go to `--radius-big` (16px). The jump from shadcn's 6px is a
large, immediately recognisable identity shift. Do it.

### Semantic mapping

```
                  light                       dark
--background      #FBFAF8                     #141416
--card            #FFFFFF                     #1C1C1E
--surface-soft    #F1F0ED   (fills/inputs)    #2C2C2E
--sidebar         #F7F6F2                     #181819
--foreground      #1C1C1E                     #F2F2F7
--muted-foreground #636366                    #8E8E93
--primary         #1C1C1E                     #F2F2F7      <- near-black / near-white
--primary-foreground #FBFAF8                  #1C1C1E
--destructive     #D6000E                     #FF525D
--warning         #CF5826                     #FF9264
--success         #00AD30                     #37D67A
--nudge           #AD9200                     #FFE352
--ring            #1A47FF                     #4166FF
--border          ink-1000 / 60%              #FFFFFF 8%   <- hairlines only
```

Add `--color-surface-soft` and `--color-nudge` to `@theme inline` so
`bg-surface-soft` / `text-nudge` exist as utilities.

### Type scale (`@layer utilities`)

Follow the ipractis naming convention so it feels like one house.

```
.text-display   Cal Sans 30/34 600, -0.02em    page titles
.text-stat      Cal Sans 40/40 600, tabular    funnel numbers
.text-title     Cal Sans 20/26 600, -0.01em    card + sheet titles
.text-body      Inter 14/21 400
.text-body-m    Inter 14/21 500               buttons, row titles
.text-small     Inter 13/18 400               descriptions
.text-micro     Inter 11/16 500               counts, hints  (NOT uppercase)
.text-code      JetBrains Mono 12.5/18 400    paths, rule ids
```

Also port ipractis' `.focus-ring` / `.focus-ring-inset` utilities verbatim — outline-based
so they are never clipped by `overflow-hidden`, and they follow border-radius.

### Base layer

Remove the global `* { @apply border-border }` reset — it is what makes "add a border"
the path of least resistance. Set borders explicitly where wanted.

---

## Phase 2 — primitives (`studio/src/components/ui/`)

### `button.tsx` — port the ipractis shape

Variants, replacing the shadcn set:

```
primary    bg-primary text-primary-foreground hover:bg-primary/90
ghost      bg-surface-soft text-foreground hover:bg-paper-900 / ink-300   (NO border)
outline    bg-transparent border border-border hover:bg-surface-soft
danger     bg-destructive text-white hover:bg-destructive/90
icon       bg-card text-foreground aspect-square, rounded-icon
link       text-link underline-offset-4 hover:underline
```

Sizes `sm|md|lg` → `h-8 px-3` / `h-10 px-4` / `h-12 px-6`, gaps `1.5|2|2`.
Radius `rounded-big`, except `icon` → `rounded-icon`.
Keep `asChild` (used by `<Link>` wrappers) and keep the `[&_svg]:size-4` sizing rule.
Add `.focus-ring`. Keep the existing `size="icon-sm"` alias — `App.tsx:265` uses it.

### `action-button.tsx` — NEW, for the sidebar primary

The ipractis ActionButton form: full-width pill, **label left-aligned**, icon in a
small contrasting rounded square pinned right. Distinctive, from the owner's own
system, and it makes the one destructive-ish action unmistakable.

```
┌──────────────────────────────────┐
│ Run scan                    [ ▶ ]│   h-12, rounded-big, bg-primary
└──────────────────────────────────┘   icon box: size-9, rounded-icon, bg-card
```

Props: `label`, `icon`, `loading`, `variant: "primary" | "soft"`, `onClick`.
When `loading`, swap the icon for `IconLoader2 animate-spin` and dim to 60%.
Do **not** pull in `motion/react` — ipractis uses it, Studio has no such dependency
and does not need one for this.

### `search-input.tsx` — NEW, the ipractis input shape

```
┌────────────────────────────────────────────┐
│ [⌕]  Filter by file or message             │  bg-surface-soft, rounded-big
└────────────────────────────────────────────┘  h-11, NO border
   ↑ size-8 rounded-icon bg-card, raised
```

Borderless. `focus-within:bg-paper-900` (light) / `focus-within:bg-ink-300` (dark).
Inner `<input>` is fully stripped: `bg-transparent border-none outline-none
placeholder:text-muted-foreground text-body`. Focus ring goes on the **wrapper**
via `.focus-ring-inset`, not the input.

### `input.tsx` — restyle the base input to match

Borderless filled: `bg-surface-soft rounded-mid h-10 px-3`, no `shadow-xs`,
`focus-visible` → `.focus-ring-inset`. Used by `Config.tsx` and `ChipEditor`.

### `card.tsx`

Drop `border` and `shadow-sm` from `Card`. Becomes `bg-card rounded-huge p-6`.
Depth comes from surface colour, not outline. Reduce default `gap-6` → `gap-5`.

### `badge.tsx`

Retune the soft variants to the new ramps and **drop the border** from each
(`border-transparent` throughout — the tint alone reads):

```
soft-danger   bg-destructive/12  text-destructive
soft-warn     bg-warning/14      text-warning
soft-good     bg-success/12      text-success
soft-muted    bg-surface-soft    text-muted-foreground
code          bg-surface-soft    text-muted-foreground  text-code   <- rule IDs
```

Delete `soft-primary` (it was the indigo). `RuleTag` moves to the new `code` variant.

### `tabs.tsx`

Add an `underline` variant to `TabsList`/`TabsTrigger`: no pill container, no
background. Trigger is text + count; active state is `text-foreground` plus a 2px
`bg-foreground` bar underneath. Inactive `text-muted-foreground`.

### `toggle-group.tsx`

Filter chips: off = `bg-surface-soft text-muted-foreground`,
on = `bg-primary text-primary-foreground`. `rounded-mid`, `h-8`, `text-code`.
No `variant="outline"` anywhere.

---

## Phase 3 — patterns

### `section-header.tsx` — gut the tile

Remove `icon` from the default rendering path. New shape:

- `size="lg"` (page): `<h1 class="text-display">` + `<p class="text-small text-muted-foreground">` + optional right-side action. **No icon.**
- `size="sm"` (card): `<h3 class="text-title">` + `<p class="text-small text-muted-foreground">`. Optional bare 16px muted icon inline before the title — opt-in via a new `glyph` prop, **not** the old always-on tile.

Delete `SectionHeaderIcon` and `iconClassName`. Update all 8 call sites in
`shared.tsx` and 11 in `Overview.tsx`; `PageHeader` stops forwarding `icon`.

### `shared.tsx`

**`StatCard` → delete. Replace with `TallyList` + `TallyRow`.**

```tsx
<TallyList>
  <TallyRow
    value={42}
    label="New"
    hint="These fail the gate in CI."
    tone="danger"
  />
  <TallyRow value={0} label="Accepted" hint="Recorded in the baseline file." />
  <TallyRow
    value={0}
    label="Suppressed"
    hint="Silenced by an inline comment."
  />
</TallyList>
```

Row: `grid grid-cols-[5.5rem_1fr] gap-x-4 py-4`. Value is `.text-stat` right-aligned
in the fixed column so the digits stack. Label `.text-body-m`, hint `.text-small
text-muted-foreground`. `tone="danger"` tints **only the number**, and only when
it is non-zero — a zero is not bad news and must not be red.

The left rail: an absolutely-positioned 1px line in `--border` running the list's
height, with a `size-2 rounded-full bg-border` marker per row (marker
`bg-destructive` when that row's tone is danger and the value > 0). No card, no
border, no icon.

**`ListPanel`:** remove the outer `border` and `shadow-sm`; keep `bg-card
rounded-huge overflow-hidden`. Keep the internal `divide-y` but soften to
`divide-border/50` — **judgment call, flag it**: "no borders" was about decorative
outlines, and 40 stacked findings genuinely need row separation. If the owner wants
them gone too, the fallback is `space-y-1.5` with each row as its own `bg-card`
block.

**`PageHeader`:** drop the `icon` prop; `description` becomes a sentence, not a
dot-joined string.

**`StatusPill`:** `active` → `soft-danger` reading `new`; `baselined` → `soft-muted`
reading `accepted`; `suppressed` → `soft-muted` at 70% opacity. No green.

**`SeverityPill` / `ZoneTag`:** switch to filled Tabler icons; `ZoneTag` loses
`soft-primary` → server is `soft-muted`, client is `soft-muted` with a dotted
underline (material contrast again, matching the strip). `Crossing` keeps the arrow
— it is a diagram, not button text.

**`Empty`:** drop `border-dashed`; use `bg-surface-soft rounded-huge`. Icon keeps a
tile here (an empty state _should_ have one focal object) but tinted
`bg-card text-muted-foreground`, not `bg-primary/10 text-primary`.

**`CodeFrame`:** `bg-surface-soft`, no border, `rounded-mid`, `.text-code`. Sink
line stays `bg-destructive/10` with the caret row in `--destructive`.

### `charts.tsx`

**`BoundaryStrip` — the hero. Rebuild.**

```
┌────────────────────────────────────────────────────────────────┐
│████████████████ Server ███████████║░░░░░░░ Client ░░░░░░░░░░░░│
│                                   ║                            │
│████ 726 ████████ files ██████████●║░░ 253 ░░░░░ files ░░░░░░░░│
└────────────────────────────────────────────────────────────────┘
  ↑ solid bg-primary/text-primary-foreground   ↑ bg-surface-soft +
                                                 diagonal hatch @4%
  seam ║ : 2px. --destructive when new crossings exist, else --foreground/25
  dot  ● : size-3.5, --destructive / --warning by severity;
           accepted = ring only (bg-card, border-current)
```

- Height `h-40`, `rounded-huge`, **no border, no shadow**.
- Hatch via `repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 6px)`
  at `opacity-[0.04]` on an `aria-hidden` overlay.
- Zone labels use filled `IconServerFilled` / `IconDeviceDesktopFilled`, 14px.
- Numbers `.text-stat`.
- Caption below absorbs the killed "Sensitive fields" card:
  `"2 values crossed into client components. 0 of 0 schema fields are sensitive."`
  — one sentence, no middle dots.
- Dots animate in staggered on mount (~40ms apart). Only motion on the page.

**`RuleBars`:** bar fill `bg-foreground/80`, accepted segment `bg-foreground/25`.
Track `bg-surface-soft`. Rule ID uses the new `code` badge.

**`TrendLine`:** `var(--primary)` → `var(--foreground)` for line and dots; area fill
`var(--foreground)` @ 0.06. Markers get `stroke="var(--card)"`. Tooltip uses a
sentence, not `·` separators.

### `finding-sheet.tsx`

Sweep for `bg-primary` / `text-primary` / `border`; title → `.text-title`; paths →
`.text-code`. Sheet surface `bg-card`, no border, `rounded-huge` on the inner edge.

---

## Phase 4 — pages

### `App.tsx` — sidebar

- **Remove `border-r`.** `bg-sidebar` alone separates it.
- Logo tile: `bg-primary text-primary-foreground` (now near-black/near-white), not
  indigo. `IconShieldLockFilled`.
- Remove the `<Separator>` under the logo and the `border-t` above the buttons —
  use spacing.
- Nav: active = `bg-card text-foreground font-medium` (a raised chip on the sidebar
  surface) with a 2px `bg-foreground` rail on its left edge. Remove
  `[&_svg]:text-primary`. Filled Tabler icons throughout.
- `Run scan` → the new `<ActionButton variant="primary">`.
- `Record baseline` → `<Button variant="ghost">` (soft fill, **no** outline).
- The "no config — run init" note: this is the one job for `--nudge`.
  `text-nudge` with `IconAlertTriangleFilled`. Split it off the "Last scan…" line
  instead of appending with `·`.
- Main content padding `px-10 py-8` → `px-12 py-10`, max-width 1200 → 1120.

### `Overview.tsx`

```
Overview                                          [ Open findings ]
Ran Sep 5 at 6:23 AM. Took 14.3 s across 4 rules.

╔══════════════ BOUNDARY STRIP (hero) ═══════════════════════════╗
╚════════════════════════════════════════════════════════════════╝
2 values crossed into client components. 0 of 0 schema fields are sensitive.

┌── Triage ──────────────┐   ┌── Findings by rule ─────────────┐
│ ┏  42   New            │   │ BG-001  ▏                     0 │
│ ┃       Fail CI.       │   │ BG-002  ████████████████     40 │
│ ┣   0   Accepted       │   │ BG-003  ▎                     2 │
│ ┃       In baseline.   │   │ BG-004  ▏                     0 │
│ ┗   0   Suppressed     │   └─────────────────────────────────┘
│         Inline comment.│   ┌── New findings across scans ────┐
└────────────────────────┘   │ (sparkline / empty note)        │
                              └─────────────────────────────────┘
```

- Grid `lg:grid-cols-[minmax(280px,340px)_1fr]`, gap 8.
- `Open findings` — **drop the `IconArrowRight`**, `variant="ghost"`.
- Subtitle becomes the sentence above. Rule list moves out of the subtitle (it is
  in the by-rule panel already).
- Delete the whole 4-up `StatCard` grid.

### `Findings.tsx`

```
Findings
Scan 1, run 12 minutes ago. 42 new, 0 accepted, 0 suppressed.   [ Scan 1 ▾ ]

New 42    Accepted 0    Suppressed 0    All 42
━━━━━━                                                 <- 2px indicator

┌ ⌕  Filter by file or message ─────┐   BG-001 BG-002 BG-003 BG-004
└───────────────────────────────────┘          ▓▓▓▓▓▓ (on = filled)

│▎ BG-002  Server Action accepts input without validation      new  ›
│   app/actions/user.ts:14:3
│▎ BG-002  …
```

Two **separate** rows, as asked — tabs on row 1, search + rule chips on row 2 with
`mb-6` between them and the list. Not one crowded flex line.

- Tabs: new `underline` variant. Counts as plain `.text-micro tabular-nums`
  beside the label — **delete the `Count` badge component**.
- Search: `<SearchInput>`, `w-80`, left-aligned.
- Rule chips: `ToggleGroup` filled, pushed right with `ml-auto`.
- Row severity rail: keep the 1px left bar, `bg-destructive` / `bg-warning`.
- Row hover `bg-surface-soft/60`.

### `Files.tsx` · `Sources.tsx` · `Config.tsx` · `Scans.tsx` · `Graph.tsx`

Mechanical sweep, no redesign:

1. `grep -rn "bg-primary\|text-primary\|border-primary\|soft-primary" studio/src` → zero hits outside `ui/button.tsx` and the sidebar logo.
2. Remove decorative `border` / `shadow-sm` from `Card` / panel wrappers.
3. `PageHeader` calls drop `icon=`; subtitles become sentences (no `·`).
4. Outline icons → filled for status glyphs.
5. `Graph.tsx` (897 lines) — node components in `components/graph/` need
   `--primary` → `--foreground` and the zone treatment matched to the strip
   (server = solid, client = hatched). Largest single file; budget for it.

---

## Phase 5 — verification

```
pnpm typecheck        # tsc --noEmit && tsc -p studio/tsconfig.json --noEmit
pnpm lint
pnpm test
pnpm build            # tsup && vite build
```

Then run it and look:

```
pnpm dev studio --no-open      # API on 8080
pnpm dev:studio                # Vite on 5173
```

Screenshot **both themes** on Overview and Findings. Check by eye:

- [ ] No saturated indigo anywhere.
- [ ] Colour appears only on: severity rails, crossing dots, status pills, the
      seam when hot, the config nudge, the focus ring.
- [ ] Zero visible outer borders on cards, sidebar, tally list, filter bar.
- [ ] Cal Sans on titles and tally numbers; JetBrains Mono on every file path.
- [ ] No `·`-joined meta string, no `→` in a button, no ALL-CAPS label.
- [ ] Tab through: focus ring visible on every control, never clipped.
- [ ] 1280px and 1440px both hold; sidebar + content do not collide.

---

## Out of scope

Do not touch: `src/studio/server.ts`, `src/studio/types.ts`, `src/engine.ts`,
`src/storage/*`, or any test under `tests/`. This is presentation only — no API
shape changes, no data-fetching changes. If a redesign seems to need a new field
from the API, stop and raise it instead.

## Decisions to confirm with the owner

1. **Divider hairlines inside `ListPanel`** — kept (see Phase 3). Ping if "no
   borders" was meant absolutely; fallback documented.
2. **Cal Sans delivery** — npm package if it exists, else self-hosted woff2.
   Self-hosting is preferred regardless (offline tool).
3. **Poppins removal** contradicts an earlier stated preference; this plan follows
   the newer instruction. The stored design-preference note needs updating.
