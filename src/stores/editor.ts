/**
 * The editor store: the immutable original + the current operation list, plus
 * undo/redo. Everything the UI shows is *derived* from (original, operations) — the
 * store never writes edits back into the source, which is what keeps editing
 * non-destructive.
 *
 * History model: discrete actions go through committed setters (`setFilter` /
 * `setCrop` / `setAdjust`) or `commit(fn)` — each is exactly one undo step and the
 * snapshot can't be forgotten. A live gesture (slider drag) is the one exception: it
 * snapshots ONCE via `beginChange()` and then calls `updateAdjust()` per move, so the
 * whole drag collapses to a single undo step.
 */
import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { AdjustOp, FilterName, Operation, ReadonlyOperation } from '../core/operations'
import { findOp, isNeutralAdjust, makeAdjust, normalizeOperations } from '../core/operations'
import type { RenderSource } from '../core/renderer'
import type { EditDocument, SourceMeta } from '../core/document'
import { createDocument } from '../core/document'

export interface LoadPayload {
  bitmap: RenderSource
  meta: SourceMeta
  dataUrl: string
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

// Operations are intentionally FLAT (crop/adjust/filter carry only primitive fields), so
// a per-op shallow spread is a complete clone for history snapshots — no aliasing across
// undo entries. A nested op field would need a deep clone here (see NOTES: op model).
const cloneOps = (ops: readonly Operation[]): Operation[] => ops.map((o) => ({ ...o }))

/** Free a decoded ImageBitmap's native memory (canvas/img sources have no close()). */
function releaseSource(src: RenderSource | null): void {
  // typeof guard: ImageBitmap is undefined under jsdom (tests) but present in browsers.
  if (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) src.close()
}

export const useEditorStore = defineStore('editor', () => {
  // ---- source (immutable once loaded) ----
  const original = shallowRef<RenderSource | null>(null)
  const sourceMeta = ref<SourceMeta | null>(null)
  const sourceDataUrl = ref<string | null>(null)

  // ---- edit model ----
  const operations = ref<Operation[]>([])
  const undoStack = ref<Operation[][]>([])
  const redoStack = ref<Operation[][]>([])

  // hold-to-compare against the unedited original
  const viewOriginal = ref(false)

  // export settings (UI state shared between the top-bar action and the export panel)
  const exportFormat = ref<'image/png' | 'image/jpeg'>('image/png')
  const exportQuality = ref(92)
  const embedOriginal = ref(false)

  // ---- derived views ----
  /** Read-only view of the op list — mutations must go through the actions below. The
   *  ReadonlyOperation element type also blocks in-place field edits (`ops[0].x = …`). */
  const operationList = computed<readonly ReadonlyOperation[]>(() => operations.value)
  const isLoaded = computed(() => original.value !== null)
  const hasEdits = computed(() => operations.value.length > 0)
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  const adjust = computed<AdjustOp>(() => findOp(operations.value, 'adjust') ?? makeAdjust())
  const filterName = computed<FilterName | null>(
    () => findOp(operations.value, 'filter')?.name ?? null,
  )
  const crop = computed<CropRect | null>(() => {
    const op = findOp(operations.value, 'crop')
    return op ? { x: op.x, y: op.y, width: op.width, height: op.height } : null
  })

  /** Operations actually rendered in the preview — empty while comparing to the original. */
  const previewOperations = computed<readonly Operation[]>(() =>
    viewOriginal.value ? [] : operations.value,
  )

  // ---- history ----
  function beginChange(): void {
    undoStack.value.push(cloneOps(operations.value))
    redoStack.value = []
  }
  function undo(): void {
    const prev = undoStack.value.pop()
    if (!prev) return
    redoStack.value.push(cloneOps(operations.value))
    operations.value = prev
  }
  function redo(): void {
    const next = redoStack.value.pop()
    if (!next) return
    undoStack.value.push(cloneOps(operations.value))
    operations.value = next
  }
  /** Run `mutator` as one atomic, undoable change (snapshots first). */
  function commit(mutator: () => void): void {
    beginChange()
    mutator()
  }

  // ---- op writers (private): normalise the list; they do NOT touch history ----
  // Not exported. Every public entry point below either wraps these in commit()
  // (discrete actions) or pairs them with one beginChange() (a live gesture), so no
  // caller can mutate the model without producing exactly one undo step.
  function writeAdjust(partial: Partial<Omit<AdjustOp, 'type'>>): void {
    const next: AdjustOp = { ...adjust.value, ...partial, type: 'adjust' }
    const rest = operations.value.filter((o) => o.type !== 'adjust')
    operations.value = normalizeOperations(isNeutralAdjust(next) ? rest : [...rest, next])
  }
  function writeFilter(name: FilterName | null): void {
    const rest = operations.value.filter((o) => o.type !== 'filter')
    operations.value = normalizeOperations(name ? [...rest, { type: 'filter', name }] : rest)
  }
  function writeCrop(rect: CropRect | null): void {
    const rest = operations.value.filter((o) => o.type !== 'crop')
    operations.value = normalizeOperations(rect ? [...rest, { type: 'crop', ...rect }] : rest)
  }

  // ---- discrete actions (public): one call = one undoable step; the snapshot is
  // baked in, so a caller can't forget it. ----
  function setAdjust(partial: Partial<Omit<AdjustOp, 'type'>>): void {
    commit(() => writeAdjust(partial))
  }
  function setFilter(name: FilterName | null): void {
    commit(() => writeFilter(name))
  }
  function setCrop(rect: CropRect | null): void {
    commit(() => writeCrop(rect))
  }

  // ---- live gesture (public): the slider drag needs many mutations under a single
  // undo step, so it snapshots ONCE via beginChange() then calls this per move. ----
  function updateAdjust(partial: Partial<Omit<AdjustOp, 'type'>>): void {
    writeAdjust(partial)
  }

  function reset(): void {
    if (!hasEdits.value) return
    commit(() => {
      operations.value = []
    })
  }

  function setViewOriginal(value: boolean): void {
    viewOriginal.value = value
  }

  // ---- source + document ----
  function loadImage(payload: LoadPayload): void {
    releaseSource(original.value)
    original.value = payload.bitmap
    sourceMeta.value = payload.meta
    sourceDataUrl.value = payload.dataUrl
    operations.value = []
    undoStack.value = []
    redoStack.value = []
    viewOriginal.value = false
  }

  /** Unload the current image and return to the empty state. */
  function removeImage(): void {
    releaseSource(original.value)
    original.value = null
    sourceMeta.value = null
    sourceDataUrl.value = null
    operations.value = []
    undoStack.value = []
    redoStack.value = []
    viewOriginal.value = false
  }

  function buildDocument(embed: boolean): EditDocument {
    if (!sourceMeta.value) throw new Error('No image loaded')
    const embedded = embed ? (sourceDataUrl.value ?? undefined) : undefined
    return createDocument(sourceMeta.value, operations.value, embedded)
  }

  /** Replay: apply a document's operations onto the current original (undoable). */
  function applyOperations(ops: readonly Operation[]): void {
    commit(() => {
      operations.value = normalizeOperations(cloneOps(ops))
    })
  }

  return {
    original,
    sourceMeta,
    sourceDataUrl,
    operations: operationList,
    viewOriginal,
    exportFormat,
    exportQuality,
    embedOriginal,
    isLoaded,
    hasEdits,
    canUndo,
    canRedo,
    adjust,
    filterName,
    crop,
    previewOperations,
    beginChange,
    commit,
    undo,
    redo,
    setAdjust,
    setFilter,
    setCrop,
    updateAdjust,
    reset,
    setViewOriginal,
    loadImage,
    removeImage,
    buildDocument,
    applyOperations,
  }
})
