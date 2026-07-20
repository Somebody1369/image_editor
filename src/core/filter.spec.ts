import { describe, expect, it } from 'vitest'
import { makeAdjust } from './operations'
import type { Operation } from './operations'
import { compileCanvasFilter, compileSvgPrimitives, GREYSCALE_MATRIX, SEPIA_MATRIX } from './filter'

describe('compileCanvasFilter', () => {
  it('is "none" with no ops or a neutral adjust', () => {
    expect(compileCanvasFilter([])).toBe('none')
    expect(compileCanvasFilter([makeAdjust()])).toBe('none')
  })

  it('maps percentages to CSS filter factors', () => {
    expect(compileCanvasFilter([makeAdjust({ brightness: 10 })])).toBe('brightness(1.1)')
    expect(compileCanvasFilter([makeAdjust({ contrast: -50 })])).toBe('contrast(0.5)')
    expect(compileCanvasFilter([makeAdjust({ saturation: 100 })])).toBe('saturate(2)')
  })

  it('emits filters after adjustments in canonical order', () => {
    const ops: Operation[] = [
      { type: 'filter', name: 'sepia' },
      makeAdjust({ brightness: 20, saturation: -30 }),
    ]
    expect(compileCanvasFilter(ops)).toBe('brightness(1.2) saturate(0.7) sepia(1)')
    expect(compileCanvasFilter([{ type: 'filter', name: 'greyscale' }])).toBe('grayscale(1)')
  })
})

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

  it('maps saturation and filters to colour matrices', () => {
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

describe('canvas ↔ SVG parity for tone', () => {
  // The SVG componentTransfer must reproduce the canvas `brightness() contrast()`
  // result: out = kb·kc·x + (0.5 − 0.5·kc). Verified across a grid of pixels/params.
  const factor = (p: number) => 1 + p / 100

  it('produces the same channel value on both backends', () => {
    for (const brightness of [-100, -40, 0, 30, 100]) {
      for (const contrast of [-80, 0, 50, 100]) {
        const [prim] = compileSvgPrimitives([makeAdjust({ brightness, contrast })])
        const kb = factor(brightness)
        const kc = factor(contrast)
        for (const x of [0, 0.25, 0.5, 0.75, 1]) {
          const canvas = (x * kb - 0.5) * kc + 0.5
          const svg =
            prim && prim.kind === 'componentTransfer' ? x * prim.slope + prim.intercept : x
          expect(svg).toBeCloseTo(canvas, 2)
        }
      }
    }
  })
})
