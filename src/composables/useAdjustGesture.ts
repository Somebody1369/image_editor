/**
 * History bookkeeping for the tone sliders, kept out of the component.
 *
 * A drag or a run of arrow-key presses must collapse to ONE undo step, and an
 * interaction that changes nothing (a click on the thumb without moving, a key press
 * at the slider's limit) must create NO undo step and must not wipe the redo stack.
 *
 * Both are handled by arming a gesture (pointer-down or a value key-down) and taking
 * the snapshot LAZILY — on the first change that actually fires. A stray change with
 * no gesture armed still commits as its own undo step, so no edit is ever lost from
 * history.
 */
import { useEditorStore } from '../stores/editor'

type AdjustKey = 'brightness' | 'contrast' | 'saturation'

const VALUE_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

export function useAdjustGesture() {
  const store = useEditorStore()
  let armed = false
  let snapshotted = false

  function end(): void {
    armed = false
    snapshotted = false
  }

  /** A slider emitted a new value. */
  function apply(key: AdjustKey, value: number): void {
    if (!armed) {
      // No gesture in progress — treat as a discrete, self-contained undo step.
      store.setAdjust({ [key]: value })
      return
    }
    if (!snapshotted) {
      store.beginChange()
      snapshotted = true
    }
    store.updateAdjust({ [key]: value })
  }

  /** Pointer-down on the slider: arm; the snapshot waits for the first real change. */
  function pointerStart(): void {
    armed = true
  }

  function keydown(event: KeyboardEvent): void {
    if (VALUE_KEYS.has(event.key)) armed = true
  }

  function keyup(event?: KeyboardEvent): void {
    if (event && !VALUE_KEYS.has(event.key)) return
    end()
  }

  return { apply, pointerStart, end, keydown, keyup }
}
