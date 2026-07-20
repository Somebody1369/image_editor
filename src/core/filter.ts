/**
 * Compiles the `adjust` + `filter` operations into a colour transform.
 *
 * There is ONE definition of the colour maths — the ordered `SvgPrimitive[]` list
 * produced by `compileSvgPrimitives` — and it drives both render paths:
 *   - the **live preview** renders the list declaratively as an SVG `<filter>` graph
 *     (see `SvgFilterDefs.vue`), so a slider drag just updates primitive attributes;
 *   - the **export** executes the exact same list on the pixels via `applyPrimitives`.
 *
 * Because both consume the identical primitive list — same primitives, same order,
 * same [0,1] clamp at every primitive boundary — the preview and the exported pixels
 * agree by construction. The export path is plain ImageData maths, so it is
 * deterministic and works even where a browser's `ctx.filter` is unavailable.
 *
 * The primitives follow the CSS Filter Effects spec; greyscale/sepia use the spec's
 * exact colour matrices and saturate uses the spec's coefficients, which is what lets
 * the JS executor reproduce what the browser's SVG `<filter>` shows.
 */
import type { AdjustOp, FilterOp, Operation } from './operations'

/** percentage in [-100, 100] → multiplicative factor (0 → 0, 0% → 1, 100 → 2). */
const factor = (percent: number): number => 1 + percent / 100
const round = (n: number): number => Math.round(n * 1000) / 1000

/** CSS `grayscale(1)` as an feColorMatrix (Rec.709 luminance). */
// prettier-ignore
export const GREYSCALE_MATRIX: readonly number[] = [
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
]

/** CSS `sepia(1)` as an feColorMatrix (per the Filter Effects spec). */
// prettier-ignore
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

export type SvgPrimitive =
  /** feComponentTransfer with a linear R/G/B function: out = slope·in + intercept. */
  | { kind: 'componentTransfer'; slope: number; intercept: number }
  /** feColorMatrix type="saturate". */
  | { kind: 'saturate'; value: number }
  /** feColorMatrix type="matrix" (20 values), used for greyscale/sepia. */
  | { kind: 'matrix'; values: readonly number[] }

/**
 * The canonical colour pipeline as an ordered primitive list. brightness (×kb)
 * followed by contrast ((x−0.5)·kc + 0.5) compose to a single linear transfer:
 *   out = kb·kc·in + (0.5 − 0.5·kc)
 * so tone is one `componentTransfer`; saturate and greyscale/sepia are colour
 * matrices applied after it. Identity terms are omitted so the list is minimal and
 * deterministic for a given op list.
 */
export function compileSvgPrimitives(ops: readonly Operation[]): SvgPrimitive[] {
  const out: SvgPrimitive[] = []
  const adjust = findAdjust(ops)
  if (adjust) {
    const kb = factor(adjust.brightness)
    const kc = factor(adjust.contrast)
    const ks = factor(adjust.saturation)
    if (kb !== 1 || kc !== 1) {
      out.push({
        kind: 'componentTransfer',
        slope: round(kb * kc),
        intercept: round(0.5 - 0.5 * kc),
      })
    }
    if (ks !== 1) out.push({ kind: 'saturate', value: round(ks) })
  }
  const filter = findFilter(ops)
  if (filter) {
    out.push({
      kind: 'matrix',
      values: filter.name === 'greyscale' ? GREYSCALE_MATRIX : SEPIA_MATRIX,
    })
  }
  return out
}

// ---- pixel executor (the export backend) -----------------------------------
// Operates in place on the RGBA bytes of an ImageData. Each primitive reads the
// current 8-bit buffer and writes back through the Uint8ClampedArray, which rounds
// and clamps to [0,255] — modelling the [0,1] clamp SVG applies at every primitive
// boundary, so the two backends stay in step.

/** out = slope·in + intercept, per R/G/B channel (alpha untouched). */
function applyComponentTransfer(data: Uint8ClampedArray, slope: number, intercept: number): void {
  const b = intercept * 255
  for (let i = 0; i < data.length; i += 4) {
    data[i] = slope * data[i] + b
    data[i + 1] = slope * data[i + 1] + b
    data[i + 2] = slope * data[i + 2] + b
  }
}

/** feColorMatrix type="saturate" — the spec's exact coefficients. */
function applySaturate(data: Uint8ClampedArray, s: number): void {
  const rr = 0.213 + 0.787 * s
  const rg = 0.715 - 0.715 * s
  const rb = 0.072 - 0.072 * s
  const gr = 0.213 - 0.213 * s
  const gg = 0.715 + 0.285 * s
  const gb = 0.072 - 0.072 * s
  const br = 0.213 - 0.213 * s
  const bg = 0.715 - 0.715 * s
  const bb = 0.072 + 0.928 * s
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    data[i] = rr * r + rg * g + rb * b
    data[i + 1] = gr * r + gg * g + gb * b
    data[i + 2] = br * r + bg * g + bb * b
  }
}

/** feColorMatrix type="matrix" — 20 values, operating in normalised [0,1] space. */
function applyColorMatrix(data: Uint8ClampedArray, m: readonly number[]): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const a = data[i + 3] / 255
    data[i] = (m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4]) * 255
    data[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9]) * 255
    data[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]) * 255
    data[i + 3] = (m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19]) * 255
  }
}

/** Execute the primitive list in order on RGBA pixel bytes, in place. */
export function applyPrimitives(
  data: Uint8ClampedArray,
  primitives: readonly SvgPrimitive[],
): void {
  for (const p of primitives) {
    if (p.kind === 'componentTransfer') applyComponentTransfer(data, p.slope, p.intercept)
    else if (p.kind === 'saturate') applySaturate(data, p.value)
    else applyColorMatrix(data, p.values)
  }
}
