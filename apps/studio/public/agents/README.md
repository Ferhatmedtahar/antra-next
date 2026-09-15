# Agent marks

Drawn on the single "Copy to your agent" button in the finding sheet. Four
marks, then an ellipsis chip standing for the agents that are not drawn — the
prompt is identical for all of them, so the row says where it goes rather than
offering a choice. The full list is in the button's tooltip.

| File         | Shown as |
| ------------ | -------- |
| `claude.svg` | Claude   |
| `openai.svg` | ChatGPT  |
| `gemini.svg` | Gemini   |
| `cursor.svg` | Cursor   |

The filename and the label differ for ChatGPT because lobehub files that mark
under its maker's name. `SHOWN` in `src/components/copy-for-agent.tsx` holds the
mapping.

## What the component expects

- **Square viewBox, single-colour artwork.** Each mark renders at 16px inside a
  28px chip and is forced monochrome with `brightness-0 dark:invert`, so one
  file covers both themes. A gradient or multi-colour logo still flattens to
  one colour, but artwork whose meaning is in the colour will lose it.
- **No `width`/`height` on the root `<svg>`, or only in `em`.** The component
  sizes the `<img>`; the attributes are overridden either way. Keep `viewBox`.
- The official brand asset, unmodified apart from colour. These are other
  companies' trademarks: use them to say where the prompt goes, and nothing
  more. Do not imply partnership or endorsement.

## If a file is missing

Its own chip is dropped and the rest of the row survives. If none of them
resolve, the button falls back to a single copy mark. It always reads and always
copies; nothing else needs to change.
