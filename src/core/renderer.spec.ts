import { describe, expect, it } from 'vitest'
import type { Operation } from './operations'
import { resolveCrop } from './renderer'

const size = { width: 4000, height: 3000 }

describe('resolveCrop', () => {
  it('defaults to the whole image when there is no crop op', () => {
    expect(resolveCrop([], size)).toEqual({ x: 0, y: 0, width: 4000, height: 3000 })
  })

  it('returns an in-bounds crop unchanged', () => {
    const ops: Operation[] = [{ type: 'crop', x: 320, y: 128, width: 2400, height: 1800 }]
    expect(resolveCrop(ops, size)).toEqual({ x: 320, y: 128, width: 2400, height: 1800 })
  })

  it('clamps a crop that overflows the source bounds', () => {
    const ops: Operation[] = [{ type: 'crop', x: 3800, y: 2900, width: 1000, height: 1000 }]
    // x/y stay in-bounds; width/height shrink to what is left of the image.
    expect(resolveCrop(ops, size)).toEqual({ x: 3800, y: 2900, width: 200, height: 100 })
  })

  it('clamps negative origins to zero and keeps a minimum 1px size', () => {
    const ops: Operation[] = [{ type: 'crop', x: -50, y: -50, width: 0, height: -10 }]
    const rect = resolveCrop(ops, size)
    expect(rect.x).toBe(0)
    expect(rect.y).toBe(0)
    expect(rect.width).toBeGreaterThanOrEqual(1)
    expect(rect.height).toBeGreaterThanOrEqual(1)
  })
})
