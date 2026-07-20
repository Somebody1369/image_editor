# Notes — key decisions & trade-offs

A small non-destructive image editor. The interesting part isn't the pixels — it's
**how the edits are modelled**. Everything below follows from one idea.

## The core idea: edits are data, not pixels

The original image is immutable. An edit is an **ordered, serializable list of
operations**. Every preview and every export is _derived_ by replaying that list on
the original — the source is never written to.

```ts
type Operation =
  | { type: 'crop'; x: number; y: number; width: number; height: number } // source pixels
  | { type: 'adjust'; brightness: number; contrast: number; saturation: number } // each −100..100
  | { type: 'filter'; name: 'greyscale' | 'sepia' }
```

Once you have this, most requirements stop being separate features and become views
of the same model:

| Requirement             | How it falls out of the model                                       |
| ----------------------- | ------------------------------------------------------------------- |
| Non-destructive         | preview = `render(original, operations)`; the source is read-only   |
| Reset                   | `operations = []`                                                   |
| View original           | render with `operations = []` while a button is held (before/after) |
| Undo / redo             | snapshots of the operations array                                   |
| Export image            | replay the list at full resolution                                  |
| **JSON export (bonus)** | serialize the list                                                  |

This is deliberately the same shape as a **web2print design**: a saved document of
operations that can be re-rendered later (in the browser here, or on a backend for
production output). That framing drove the choices below.

### Why one `adjust` op instead of three

Brightness/contrast/saturation are applied together in a single colour pass, so
modelling them as three independently-ordered ops would imply an order that doesn't
exist. Grouping them keeps the honest statement: **order matters only between
stages** — `crop → adjust → filter` — and that order is fixed and intentional (crop
first so tone/filter act on surviving pixels; the filter last so e.g. greyscale
lands on the colour-corrected image). The store keeps at most one op of each type
and always stores them in canonical order.

## Rendering: one model, one primitive list

The op-model is the single source of truth. It compiles **once** to an ordered list of
colour **primitives** (`compileSvgPrimitives` in `src/core/filter.ts`), and that one
list drives both render paths:

- **live preview** — the primitive list is rendered declaratively as an SVG `<filter>`
  graph, referenced from the preview canvas with CSS `filter: url(#editorFilter)`.
  Dragging a slider only updates primitive attributes → the preview updates in real
  time with **no canvas redraw**. An SVG-heavy front-end stack makes an SVG filter
  graph the natural way to express the pipeline.
- **export** — the _same_ primitive list is executed on the pixels by `applyPrimitives`
  (plain `ImageData` maths), baking the result at full resolution.

Because both consume the identical list — same primitives, same order — the two
backends apply the **same operations in the same order**, so they agree at the level of
the model. They are still two independent _implementations_ (the browser's SVG filter
engine vs. our JS `ImageData` pass), so byte-for-byte pixel agreement is not guaranteed:
the JS path clamps and rounds to 8-bit after every primitive (via `Uint8ClampedArray`),
whereas the browser keeps higher precision between chained primitives and need not clamp
intermediate results. On a pixel that overflows mid-pipeline (e.g. a brightness boost
that saturates before a filter) the two can differ by a few levels — see the
overflow-then-filter case in `src/core/filter.spec.ts`. A rasterised SVG-vs-JS parity
test would need a real browser (Vitest browser mode); the current tests pin the JS side.
brightness (`×kb`) then contrast (`(x−0.5)·kc+0.5`) compose to one linear transfer
`kb·kc·x + (0.5−0.5·kc)`; greyscale/sepia use the spec's exact colour matrices;
`color-interpolation-filters` is `sRGB` to match the sRGB pixel maths. The export is our
own `ImageData` pass rather than the browser's `ctx.filter`, so it is deterministic and
works even where `ctx.filter` is unavailable. Unit tests bake pixels through
`applyPrimitives` and assert exact bytes for brightness, contrast, greyscale, sepia and
saturate, including the overflow-then-filter case (`src/core/filter.spec.ts`).

Crop is pure geometry (a source sub-rectangle drawn with `drawImage`), stored in
**original pixels** so it is resolution-independent and replays on the full-res
image. cropperjs is used only as the crop _interface_ — we read `getData()` and store
the rectangle; the app's own renderer does the cropping.

**Performance:** the preview renders to a downscaled canvas (long edge ≤ 1600px);
export runs once at full resolution. Because colour is a live SVG filter, slider
drags don't touch the canvas at all.

## The JSON bonus

`src/core/document.ts` — a thin, self-describing document:

```json
{
  "version": 1,
  "source": { "name": "poster.jpg", "width": 4000, "height": 3000, "type": "image/jpeg" },
  "operations": [
    { "type": "crop", "x": 320, "y": 128, "width": 2400, "height": 1800 },
    { "type": "adjust", "brightness": 12, "contrast": -6, "saturation": 20 },
    { "type": "filter", "name": "sepia" }
  ]
}
```

- **Thin by default** (no pixels) so it sits _alongside_ the image, as the brief
  says. `source` identifies the original; operations are in source pixels, so the
  document replays unambiguously.
- **"Embed original" toggle** adds the source as a data URL so the document
  self-replays in one click — handy to demonstrate the round-trip. Note the embedded
  source is the orientation-normalised, re-encoded image (a JPEG is re-encoded at
  q0.92), not the original file's exact bytes: the embedded round-trip reproduces the
  _operations_ faithfully, while the embedded pixels are a normalised copy.
- **Import replays it.** With an embedded original the whole result is reproduced;
  otherwise the operations apply to the currently loaded image. `parseDocument`
  validates shape, rejects unknown ops, and clamps values. The `version` field is
  reserved for future migration; it is currently v1-only — `parseDocument` rejects any
  other version rather than migrating it.

Because preview, export and replay all call the **same** renderer over the **same**
op list, replaying a document reproduces the result by construction — verified by a
serialize→parse round-trip test and by an in-app import round-trip.

## Non-destructive guarantees

- The original (`ImageBitmap` / sample canvas) is loaded once and never mutated.
- Every preview is a fresh render from the original + operations.
- Reset clears the list; "hold to view original" renders with an empty list.
- Uploaded photos are decoded with EXIF orientation applied (`imageOrientation:
'from-image'`) and normalised, so orientation and crop coordinates stay consistent.

## Architecture

```
src/
  core/          # framework-free domain: operations, filter compilers, renderer, document (+ unit tests)
  composables/   # Vue glue (image loading / import)
  stores/        # Pinia: immutable source, operations, undo/redo (+ unit tests)
  components/    # Vuetify UI (canvas, panels, crop dialog, SVG filter defs)
  utils/         # image decode + download helpers
```

`core/` has zero Vue imports — the edit model is independent of the UI, which is the
part the brief is really asking about. 30 unit tests cover the primitive compiler and
the pixel-bake executor, the document round-trip/validation (including duplicate-op
collapsing and non-finite rejection), the crop geometry, the store (dedup, canonical
order, undo/redo) and the slider-gesture history (one undo step per drag, no empty
steps).

Stack: Vue 3 + Vuetify 3 + Pinia + TypeScript (strict), Vite, cropperjs, Vitest.
ESLint (flat config) + Prettier enforce correctness and layout; a GitHub Actions
workflow runs lint, format-check, tests and the type-checked build on every push.

## Trade-offs & known limitations

- **Two colour _implementations_** (an SVG `<filter>` for the live preview, an
  `ImageData` pass for the export) — but over **one** compiled primitive list, so they
  apply the same primitives in the same order. The preview stays declarative and
  real-time; the export stays deterministic and independent of `ctx.filter`. A
  pixel-level test pins the executor's output.
- **JPEG export flattens transparency onto white** (JPEG has no alpha channel), so a
  transparent PNG doesn't turn black on export; PNG keeps its alpha.
- **Colour is sRGB, browser-defined** (CSS/SVG filter math). Fine for a screen
  editor; a print pipeline would want managed colour (see roadmap).
- **Undo granularity is per gesture.** A snapshot is taken at the start of an
  interaction — pointer-down (`@start`) for a drag, first key-press for a keyboard
  nudge — so one drag or one run of arrow-key presses is a single undo step. `Ctrl/⌘+Z`
  and `Ctrl/⌘+Shift+Z` / `Ctrl/⌘+Y` are wired globally.
- **Filters are fixed** (greyscale/sepia via spec matrices); no custom colour
  matrices or curves.

## What a production version would add (out of scope on purpose)

ICC colour management / CMYK output profiles (FOGRA/GRACoL) via a CMM such as Little
CMS; a Curves/Levels tool; layers and multi-object designs; templates; **server-side
render parity** so a backend reproduces the document for production output; a WebGL
pipeline and wide-gamut output. New _op types_ (Curves/Levels, more filters) extend the
same model directly. Features that need multiple ops of one type or a user-controlled
stage order (layers, two stacked filters, filter-before-adjust) would also require
relaxing the current normalisation — at most one op per type in a fixed
`crop → adjust → filter` order — which is a deliberate simplification for this scope,
not an inherent limit of the op-list idea.

The app is already fully client-side with no runtime network calls and no CDN assets,
so it is offline-capable by construction. Making it an **offline-first, installable
PWA** (a service worker + web manifest via `vite-plugin-pwa`) is a small, self-contained
addition — left out here to keep the scope tight, but a natural next step.

## AI usage

AI was used throughout (as the brief encourages) for scaffolding, the colour-math
mapping and this write-up. The design decisions — the operation model, the
one-model/two-backends renderer, the SVG-native preview, and the JSON shape — are the
considered choices described above.
