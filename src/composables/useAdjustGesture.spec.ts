import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAdjustGesture } from './useAdjustGesture'
import { useEditorStore } from '../stores/editor'

beforeEach(() => setActivePinia(createPinia()))

const key = (k: string): KeyboardEvent => ({ key: k }) as KeyboardEvent

describe('useAdjustGesture', () => {
  it('collapses a pointer drag into a single undo step', () => {
    const store = useEditorStore()
    const g = useAdjustGesture()
    g.pointerStart()
    g.apply('brightness', 10)
    g.apply('brightness', 20)
    g.apply('brightness', 30)
    g.end()
    expect(store.adjust.brightness).toBe(30)
    store.undo()
    expect(store.adjust.brightness).toBe(0) // one undo, not three
    expect(store.canRedo).toBe(true)
  })

  it('a pointer-down with no movement creates no undo step and keeps redo', () => {
    const store = useEditorStore()
    const g = useAdjustGesture()
    store.setAdjust({ contrast: 15 })
    store.undo() // now there is something to redo
    expect(store.canRedo).toBe(true)

    g.pointerStart() // click the thumb…
    g.end() // …and release without moving
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true) // redo survived
  })

  it('coalesces a run of arrow-key presses into one undo step', () => {
    const store = useEditorStore()
    const g = useAdjustGesture()
    g.keydown(key('ArrowRight'))
    g.apply('saturation', 1)
    g.apply('saturation', 2)
    g.keyup(key('ArrowRight'))
    store.undo()
    expect(store.adjust.saturation).toBe(0)
    expect(store.canUndo).toBe(false)
  })

  it('commits a stray change (no gesture armed) as its own undo step', () => {
    const store = useEditorStore()
    const g = useAdjustGesture()
    g.apply('brightness', 42)
    expect(store.adjust.brightness).toBe(42)
    expect(store.canUndo).toBe(true)
  })
})
