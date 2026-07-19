import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from './editor'
import type { RenderSource } from '../core/renderer'

beforeEach(() => setActivePinia(createPinia()))

describe('editor store — edit model', () => {
  it('keeps at most one adjust op and drops it when neutral', () => {
    const s = useEditorStore()
    s.setAdjust({ brightness: 20 })
    s.setAdjust({ contrast: -10 })
    expect(s.operations.filter((o) => o.type === 'adjust')).toHaveLength(1)
    expect(s.adjust).toMatchObject({ brightness: 20, contrast: -10, saturation: 0 })
    s.setAdjust({ brightness: 0, contrast: 0 })
    expect(s.operations.some((o) => o.type === 'adjust')).toBe(false)
  })

  it('enforces canonical order crop → adjust → filter', () => {
    const s = useEditorStore()
    s.setFilter('sepia')
    s.setAdjust({ brightness: 10 })
    s.setCrop({ x: 0, y: 0, width: 10, height: 10 })
    expect(s.operations.map((o) => o.type)).toEqual(['crop', 'adjust', 'filter'])
  })

  it('toggles a filter on and off', () => {
    const s = useEditorStore()
    s.setFilter('greyscale')
    expect(s.filterName).toBe('greyscale')
    s.setFilter(null)
    expect(s.filterName).toBeNull()
  })
})

describe('editor store — history', () => {
  it('undo/redo across an atomic change', () => {
    const s = useEditorStore()
    s.beginChange()
    s.setAdjust({ brightness: 30 })
    expect(s.adjust.brightness).toBe(30)
    expect(s.canUndo).toBe(true)
    s.undo()
    expect(s.adjust.brightness).toBe(0)
    s.redo()
    expect(s.adjust.brightness).toBe(30)
  })

  it('reset is undoable', () => {
    const s = useEditorStore()
    s.beginChange()
    s.setFilter('sepia')
    s.reset()
    expect(s.hasEdits).toBe(false)
    s.undo()
    expect(s.filterName).toBe('sepia')
  })
})

describe('editor store — document', () => {
  it('builds a document from meta + operations, embedding on request', () => {
    const s = useEditorStore()
    s.loadImage({
      bitmap: {} as unknown as RenderSource,
      meta: { name: 'a.png', width: 100, height: 80, type: 'image/png' },
      dataUrl: 'data:image/png;base64,AAAA',
    })
    s.setAdjust({ brightness: 10 })
    expect(s.buildDocument(false).embeddedSource).toBeUndefined()
    expect(s.buildDocument(false).operations).toHaveLength(1)
    expect(s.buildDocument(true).embeddedSource).toBe('data:image/png;base64,AAAA')
  })
})
