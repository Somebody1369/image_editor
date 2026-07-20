# Image Editor

A small, non-destructive browser image editor (Vue 3 + Vuetify 3 + Pinia +
TypeScript). Upload an image, crop it, adjust brightness / contrast / saturation with
a live preview, apply a greyscale/sepia filter, compare against the original, and
export the result — plus export/import the edits as a replayable JSON document.

## Run

```bash
npm install
npm run dev
```

Then open the printed local URL. No image handy? Click **Sample** to load a built-in
one. (Requires Node 20.19+ or 22.12+.)

```bash
npm run build         # type-check (vue-tsc) + production build
npm test              # unit tests (Vitest)
npm run lint          # ESLint (flat config: TS + Vue)
npm run format:check  # Prettier
```

## Features

- **Load** via Upload (with EXIF orientation), drag-and-drop, or the built-in sample.
- **Crop** (cropperjs) with aspect presets — stored in original pixels.
- **Adjust** brightness / contrast / saturation with real-time preview.
- **Filter** — greyscale or sepia.
- **Non-destructive**: the original is never modified; Reset and hold-to-compare
  return to it. Undo / redo included.
- **Export** the image (PNG/JPEG) and the operations as JSON; **Import JSON** replays
  a document to reproduce the result.

## How it works (short version)

Edits are modelled as an ordered, serializable list of operations
(`crop → adjust → filter`). The immutable original plus that list is _replayed_ to
derive every preview and export. The op-model compiles to one ordered list of colour
primitives that drives both an SVG `<filter>` live preview and an `ImageData` pixel
bake for the export, so preview and export agree by construction. See
[`NOTES.md`](./NOTES.md) for the full rationale and trade-offs.

## Structure

```
src/
  core/         # framework-free: operations, filter compilers, renderer, document (+ tests)
  composables/  # image loading / JSON import
  stores/       # Pinia editor store: source, operations, undo/redo (+ tests)
  components/   # Vuetify UI
  utils/        # decode + download helpers
```
