/**
 * The single rendering path. `renderToCanvas` is used for BOTH the live preview
 * (downscaled via `maxSize`) and the full-resolution export bake — so "what you
 * see is what you export", and replaying the op-model reproduces the result.
 *
 * The original is never mutated: every call draws from the immutable source onto a
 * fresh canvas. Crop is pure geometry (a source sub-rectangle); tone/filter are the
 * compiled `ctx.filter` string.
 */
import type { CropOp, Operation } from './operations'
import { compileCanvasFilter } from './filter'

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
  /**
   * Bake the colour transform into pixels via `ctx.filter` (used for the export).
   * The live preview leaves this `false` and applies the transform declaratively
   * through the SVG <filter>, so the source is only ever cropped here. Default `true`.
   */
  bakeFilter?: boolean
}

/** Render the pipeline (crop → adjust → filter) onto `target`. Sizes the canvas to the output. */
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
  if (options.bakeFilter !== false) ctx.filter = compileCanvasFilter(ops)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH)
  ctx.filter = 'none'
  return { width: outW, height: outH }
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
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed: toBlob returned null'))),
      mime,
      quality,
    )
  })
}
