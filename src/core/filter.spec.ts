import { describe, expect, it } from 'vitest'
import { makeAdjust } from './operations'
import { applyPrimitives, compileSvgPrimitives, GREYSCALE_MATRIX, SEPIA_MATRIX } from './filter'

describe('compileSvgPrimitives', () => {
  it('is empty for a neutral adjust', () => {
    expect(compileSvgPrimitives([makeAdjust()])).toEqual([])
  })

  it('combines brightness+contrast into one linear transfer', () => {
    expect(compileSvgPrimitives([makeAdjust({ brightness: 10 })])).toEqual([
      { kind: 'componentTransfer', slope: 1.1, intercept: 0 },
    ])
    // contrast 20 → slope 1.2, intercept 0.5 - 0.5*1.2 = -0.1
    expect(compileSvgPrimitives([makeAdjust({ contrast: 20 })])).toEqual([
      { kind: 'componentTransfer', slope: 1.2, intercept: -0.1 },
    ])
  })

  it('maps saturation and filters to colour matrices, filter last', () => {
    expect(compileSvgPrimitives([makeAdjust({ saturation: 50 })])).toEqual([
      { kind: 'saturate', value: 1.5 },
    ])
    expect(compileSvgPrimitives([{ type: 'filter', name: 'greyscale' }])).toEqual([
      { kind: 'matrix', values: GREYSCALE_MATRIX },
    ])
    expect(compileSvgPrimitives([{ type: 'filter', name: 'sepia' }])).toEqual([
      { kind: 'matrix', values: SEPIA_MATRIX },
    ])
  })
})

/** Run a single RGBA pixel through the export executor and read it back. */
function bake(
  rgba: [number, number, number, number],
  ops: Parameters<typeof compileSvgPrimitives>[0],
) {
  const data = Uint8ClampedArray.from(rgba)
  applyPrimitives(data, compileSvgPrimitives(ops))
  return Array.from(data)
}

describe('applyPrimitives (export pixel bake)', () => {
  it('is a no-op for a neutral adjust', () => {
    expect(bake([120, 130, 140, 255], [makeAdjust()])).toEqual([120, 130, 140, 255])
  })

  it('brightness scales channels and clamps at white', () => {
    // brightness +50 → ×1.5: 100→150, 200→300 clamped to 255. Alpha untouched.
    expect(bake([100, 200, 40, 255], [makeAdjust({ brightness: 50 })])).toEqual([150, 255, 60, 255])
  })

  it('contrast pivots around mid-grey', () => {
    // contrast +100 → slope 2, intercept -0.5·255. Mid-grey barely moves; 200 pushes up, 60 down.
    const [r, g, b] = bake([128, 200, 60, 255], [makeAdjust({ contrast: 100 })])
    expect(r).toBe(128) // 2·128 − 127.5 = 128.5, essentially unchanged at the pivot
    expect(g).toBe(255) // pushed to white
    expect(b).toBe(0) // pushed to black
  })

  it('greyscale collapses a colour to its luminance on every channel', () => {
    const [r, g, b, a] = bake([255, 0, 0, 255], [{ type: 'filter', name: 'greyscale' }])
    expect(r).toBe(g)
    expect(g).toBe(b)
    expect(Math.round(0.2126 * 255)).toBe(r) // Rec.709 luma of pure red
    expect(a).toBe(255)
  })

  it('applies tone before the filter (canonical order)', () => {
    // A brightness boost then greyscale must land on the boosted pixel.
    const boostedThenGrey = bake(
      [40, 40, 40, 255],
      [makeAdjust({ brightness: 100 }), { type: 'filter', name: 'greyscale' }],
    )
    expect(boostedThenGrey[0]).toBe(80) // 40×2 = 80, luma of grey(80) = 80
  })

  it('sepia maps pure red to the spec matrix result', () => {
    // R' = 0.393·255 = 100.2, G' = 0.349·255 = 89.0, B' = 0.272·255 = 69.4.
    expect(bake([255, 0, 0, 255], [{ type: 'filter', name: 'sepia' }])).toEqual([100, 89, 69, 255])
  })

  it('saturation −100 collapses a colour to its luminance on every channel', () => {
    // saturate(0): every channel = 0.213·r + 0.715·g + 0.072·b. Pure red → 0.213·255 = 54.
    expect(bake([255, 0, 0, 255], [makeAdjust({ saturation: -100 })])).toEqual([54, 54, 54, 255])
  })

  it('saturation +100 pushes channels apart around the luma axis', () => {
    // saturate(2) on a muted red [150,100,100]: R rises, G/B fall symmetrically.
    expect(bake([150, 100, 100, 255], [makeAdjust({ saturation: 100 })])).toEqual([
      189, 89, 89, 255,
    ])
  })

  it('clamps intermediate overflow to 8-bit BEFORE the next primitive (the preview-parity edge)', () => {
    // brightness +100 (×2) sends R=200 to 400, which the JS path clamps to 255 *before*
    // greyscale reads it, giving luma 133. A browser SVG filter graph does not clamp
    // between chained primitives (it would see ~400 and give ~164) — this is exactly the
    // pixel where the two backends can diverge, so we pin the JS side explicitly.
    const [r, g, b] = bake(
      [200, 50, 50, 255],
      [makeAdjust({ brightness: 100 }), { type: 'filter', name: 'greyscale' }],
    )
    expect([r, g, b]).toEqual([133, 133, 133])
  })
})
