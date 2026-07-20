/**
 * The single rendering path. `renderToCanvas` draws only the geometry (the cropped
 * sub-rectangle of the immutable source, optionally downscaled) — it is used for BOTH
 * the live preview and the export bake. Colour is applied on top:
 *   - preview: declaratively, by the SVG `<filter>` referenced with CSS `filter:url()`;
 *   - export:  by `applyPrimitives` over the pixels (see `renderToBlob`).
 * Both consume the same compiled primitive list, so what you see is what you export.
 *
 * The original is never mutated: every call draws from the immutable source onto a
 * fresh canvas.
 */
import type { CropOp, Operation } from './operations'
import { applyPrimitives, compileSvgPrimitives } from './filter'

export type RenderSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

export function getSourceSize(source: RenderSource): Size {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return { width: source.width, height: source.height }
}

/** Resolve the crop rectangle for a source, clamped to its bounds. Defaults to the whole image. */
export function resolveCrop(ops: readonly Operation[], size: Size): Rect {
  const crop = ops.find((o): o is CropOp => o.type === 'crop')
  if (!crop) return { x: 0, y: 0, width: size.width, height: size.height }

  const x = Math.max(0, Math.min(crop.x, size.width))
  const y = Math.max(0, Math.min(crop.y, size.height))
  const width = Math.max(1, Math.min(crop.width, size.width - x))
  const height = Math.max(1, Math.min(crop.height, size.height - y))
  return { x, y, width, height }
}

export interface RenderOptions {
  /** Downscale so the longest output edge is at most this many pixels (preview perf). */
  maxSize?: number
}

/** Render the crop geometry (crop → optional downscale) onto `target`. Sizes the canvas to the output. */
export function renderToCanvas(
  source: RenderSource,
  ops: readonly Operation[],
  target: HTMLCanvasElement,
  options: RenderOptions = {},
): Size {
  const size = getSourceSize(source)
  const crop = resolveCrop(ops, size)

  let outW = crop.width
  let outH = crop.height
  const longest = Math.max(outW, outH)
  if (options.maxSize && longest > options.maxSize) {
    const scale = options.maxSize / longest
    outW = Math.max(1, Math.round(outW * scale))
    outH = Math.max(1, Math.round(outH * scale))
  }

  target.width = outW
  target.height = outH
  const ctx = target.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  ctx.clearRect(0, 0, outW, outH)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH)
  return { width: outW, height: outH }
}

/** Bake the colour pipeline into the canvas pixels (no-op when there is nothing to apply). */
function bakeColor(target: HTMLCanvasElement, ops: readonly Operation[]): void {
  const primitives = compileSvgPrimitives(ops)
  if (!primitives.length) return
  const ctx = target.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  const image = ctx.getImageData(0, 0, target.width, target.height)
  applyPrimitives(image.data, primitives)
  ctx.putImageData(image, 0, 0)
}

/** Composite the canvas over a solid colour, flattening transparency (for formats without alpha). */
function flattenOnto(target: HTMLCanvasElement, color: string): void {
  const ctx = target.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, target.width, target.height)
  ctx.globalCompositeOperation = 'source-over'
}

/** Full-resolution export bake → Blob (PNG by default). */
export function renderToBlob(
  source: RenderSource,
  ops: readonly Operation[],
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  renderToCanvas(source, ops, canvas)
  bakeColor(canvas, ops)
  // JPEG has no alpha channel; flatten onto white so transparency doesn't turn black.
  if (mime === 'image/jpeg') flattenOnto(canvas, '#ffffff')
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed: toBlob returned null'))),
      mime,
      quality,
    )
  })
}
