/**
 * Compiles the `adjust` + `filter` operations into a colour transform.
 *
 * The op-model is the single source of truth; it compiles to TWO interchangeable
 * render backends over the exact same parameters:
 *   - `compileCanvasFilter`  → a `ctx.filter` string (used for the pixel-exact export bake)
 *   - `compileSvgPrimitives` → SVG <filter> primitives (used for the live, declarative
 *                              preview — SVG-native)
 *
 * Both follow the CSS Filter Effects spec, so they produce the same result. The
 * matrices below are the spec's exact grayscale()/sepia() matrices, which is what
 * makes the SVG preview and the canvas export agree.
 */
import type { AdjustOp, FilterOp, Operation } from './operations'

/** percentage in [-100, 100] → multiplicative factor (0 → 0, 0% → 1, 100 → 2). */
const factor = (percent: number): number => 1 + percent / 100
const round = (n: number): number => Math.round(n * 1000) / 1000

/** CSS `grayscale(1)` as an feColorMatrix (Rec.709 luminance). */
export const GREYSCALE_MATRIX: readonly number[] = [
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
]

/** CSS `sepia(1)` as an feColorMatrix (per the Filter Effects spec). */
export const SEPIA_MATRIX: readonly number[] = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0, 0, 0, 1, 0,
]

function findAdjust(ops: readonly Operation[]): AdjustOp | undefined {
  return ops.find((o): o is AdjustOp => o.type === 'adjust')
}
function findFilter(ops: readonly Operation[]): FilterOp | undefined {
  return ops.find((o): o is FilterOp => o.type === 'filter')
}

/**
 * Backend A: a `ctx.filter` string, e.g. `"brightness(1.1) contrast(0.9) saturate(1.2) sepia(1)"`.
 * Returns `"none"` when there is nothing to apply. Identity terms are omitted so
 * the output is minimal and deterministic for a given op list.
 */
export function compileCanvasFilter(ops: readonly Operation[]): string {
  const parts: string[] = []
  const adjust = findAdjust(ops)
  if (adjust) {
    const kb = factor(adjust.brightness)
    const kc = factor(adjust.contrast)
    const ks = factor(adjust.saturation)
    if (kb !== 1) parts.push(`brightness(${round(kb)})`)
    if (kc !== 1) parts.push(`contrast(${round(kc)})`)
    if (ks !== 1) parts.push(`saturate(${round(ks)})`)
  }
  const filter = findFilter(ops)
  if (filter) parts.push(filter.name === 'greyscale' ? 'grayscale(1)' : 'sepia(1)')
  return parts.length ? parts.join(' ') : 'none'
}

export type SvgPrimitive =
  /** feComponentTransfer with a linear R/G/B function: out = slope·in + intercept. */
  | { kind: 'componentTransfer'; slope: number; intercept: number }
  /** feColorMatrix type="saturate". */
  | { kind: 'saturate'; value: number }
  /** feColorMatrix type="matrix" (20 values), used for greyscale/sepia. */
  | { kind: 'matrix'; values: readonly number[] }

/**
 * Backend B: SVG <filter> primitives. brightness (×kb) followed by contrast
 * ((x−0.5)·kc + 0.5) compose to a single linear transfer:
 *   out = kb·kc·in + (0.5 − 0.5·kc)
 * which is exactly what `brightness(kb) contrast(kc)` does on the canvas.
 */
export function compileSvgPrimitives(ops: readonly Operation[]): SvgPrimitive[] {
  const out: SvgPrimitive[] = []
  const adjust = findAdjust(ops)
  if (adjust) {
    const kb = factor(adjust.brightness)
    const kc = factor(adjust.contrast)
    const ks = factor(adjust.saturation)
    if (kb !== 1 || kc !== 1) {
      out.push({ kind: 'componentTransfer', slope: round(kb * kc), intercept: round(0.5 - 0.5 * kc) })
    }
    if (ks !== 1) out.push({ kind: 'saturate', value: round(ks) })
  }
  const filter = findFilter(ops)
  if (filter) {
    out.push({ kind: 'matrix', values: filter.name === 'greyscale' ? GREYSCALE_MATRIX : SEPIA_MATRIX })
  }
  return out
}
