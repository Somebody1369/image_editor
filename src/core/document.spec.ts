import { describe, expect, it } from 'vitest'
import type { Operation } from './operations'
import { createDocument, parseDocument, serializeDocument, validateDocument } from './document'

const source = { name: 'poster.jpg', width: 4000, height: 3000, type: 'image/jpeg' }

const ops: Operation[] = [
  { type: 'crop', x: 320, y: 128, width: 2400, height: 1800 },
  { type: 'adjust', brightness: 12, contrast: -6, saturation: 20 },
  { type: 'filter', name: 'sepia' },
]

describe('document round-trip', () => {
  it('serialize → parse reproduces the operations (replay fidelity)', () => {
    const doc = createDocument(source, ops)
    const restored = parseDocument(serializeDocument(doc))
    expect(restored.version).toBe(1)
    expect(restored.source).toEqual(source)
    expect(restored.operations).toEqual(ops)
    expect(restored.embeddedSource).toBeUndefined()
  })

  it('keeps the embedded original when provided', () => {
    const doc = createDocument(source, ops, 'data:image/png;base64,AAAA')
    expect(parseDocument(serializeDocument(doc)).embeddedSource).toBe('data:image/png;base64,AAAA')
  })

  it('normalises operations into canonical order', () => {
    const doc = createDocument(source, [
      { type: 'filter', name: 'greyscale' },
      { type: 'adjust', brightness: 5, contrast: 0, saturation: 0 },
      { type: 'crop', x: 0, y: 0, width: 10, height: 10 },
    ])
    expect(doc.operations.map((o) => o.type)).toEqual(['crop', 'adjust', 'filter'])
  })
})

describe('validateDocument', () => {
  it('rejects malformed input with a clear error', () => {
    expect(() => validateDocument(null)).toThrow()
    expect(() => validateDocument({ version: 2, source, operations: [] })).toThrow(/version/i)
    expect(() => validateDocument({ version: 1, operations: [] })).toThrow(/source/i)
    expect(() => validateDocument({ version: 1, source, operations: {} })).toThrow(/array/i)
    expect(() =>
      validateDocument({ version: 1, source, operations: [{ type: 'blur', radius: 3 }] }),
    ).toThrow(/blur/i)
  })

  it('rejects non-finite numbers (NaN / Infinity)', () => {
    const crop = { type: 'crop', x: 0, y: 0, width: Infinity, height: 10 }
    expect(() => validateDocument({ version: 1, source, operations: [crop] })).toThrow(/finite/i)
  })

  it('collapses duplicate ops of the same type, keeping the last', () => {
    const doc = validateDocument({
      version: 1,
      source,
      operations: [
        { type: 'adjust', brightness: 5, contrast: 0, saturation: 0 },
        { type: 'adjust', brightness: 40, contrast: 0, saturation: 0 },
      ],
    })
    const adjusts = doc.operations.filter((o) => o.type === 'adjust')
    expect(adjusts).toHaveLength(1)
    expect(adjusts[0]).toMatchObject({ brightness: 40 })
  })

  it('clamps adjustment values into range', () => {
    const doc = validateDocument({
      version: 1,
      source,
      operations: [{ type: 'adjust', brightness: 999, contrast: -999, saturation: 0 }],
    })
    expect(doc.operations[0]).toEqual({
      type: 'adjust',
      brightness: 100,
      contrast: -100,
      saturation: 0,
    })
  })
})
