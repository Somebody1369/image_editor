/**
 * The editor store: the immutable original + the current operation list, plus
 * undo/redo. Everything the UI shows is *derived* from (original, operations) — the
 * store never writes edits back into the source, which is what keeps editing
 * non-destructive.
 *
 * History model: `beginChange()` snapshots the current operations onto the undo
 * stack and starts one atomic change. Discrete actions (toggle filter, apply crop,
 * reset) call it once; a slider drag calls it on pointer-down so a whole drag is a
 * single undo step.
 */
import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { AdjustOp, FilterName, Operation } from '../core/operations'
import { isNeutralAdjust, makeAdjust, sortOperations } from '../core/operations'
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

const cloneOps = (ops: readonly Operation[]): Operation[] => ops.map((o) => ({ ...o }))

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
  const isLoaded = computed(() => original.value !== null)
  const hasEdits = computed(() => operations.value.length > 0)
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  const adjust = computed<AdjustOp>(
    () => operations.value.find((o): o is AdjustOp => o.type === 'adjust') ?? makeAdjust(),
  )
  const filterName = computed<FilterName | null>(() => {
    const op = operations.value.find((o) => o.type === 'filter')
    return op ? op.name : null
  })
  const crop = computed<CropRect | null>(() => {
    const op = operations.value.find((o) => o.type === 'crop')
    return op ? { x: op.x, y: op.y, width: op.width, height: op.height } : null
  })

  /** Operations actually rendered in the preview — empty while comparing to the original. */
  const previewOperations = computed<Operation[]>(() =>
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

  // ---- mutations (upsert-by-type keeps at most one of each; canonical order enforced) ----
  function setAdjust(partial: Partial<Omit<AdjustOp, 'type'>>): void {
    const next: AdjustOp = { ...adjust.value, ...partial, type: 'adjust' }
    const rest = operations.value.filter((o) => o.type !== 'adjust')
    operations.value = sortOperations(isNeutralAdjust(next) ? rest : [...rest, next])
  }
  function setFilter(name: FilterName | null): void {
    const rest = operations.value.filter((o) => o.type !== 'filter')
    operations.value = sortOperations(name ? [...rest, { type: 'filter', name }] : rest)
  }
  function setCrop(rect: CropRect | null): void {
    const rest = operations.value.filter((o) => o.type !== 'crop')
    operations.value = sortOperations(rect ? [...rest, { type: 'crop', ...rect }] : rest)
  }

  function reset(): void {
    if (!hasEdits.value) return
    beginChange()
    operations.value = []
  }

  function setViewOriginal(value: boolean): void {
    viewOriginal.value = value
  }

  // ---- source + document ----
  function loadImage(payload: LoadPayload): void {
    original.value = payload.bitmap
    sourceMeta.value = payload.meta
    sourceDataUrl.value = payload.dataUrl
    operations.value = []
    undoStack.value = []
    redoStack.value = []
    viewOriginal.value = false
  }

  function buildDocument(embed: boolean): EditDocument {
    if (!sourceMeta.value) throw new Error('No image loaded')
    const embedded = embed ? sourceDataUrl.value ?? undefined : undefined
    return createDocument(sourceMeta.value, operations.value, embedded)
  }

  /** Replay: apply a document's operations onto the current original (undoable). */
  function applyOperations(ops: readonly Operation[]): void {
    beginChange()
    operations.value = sortOperations(cloneOps(ops))
  }

  return {
    original,
    sourceMeta,
    sourceDataUrl,
    operations,
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
    undo,
    redo,
    setAdjust,
    setFilter,
    setCrop,
    reset,
    setViewOriginal,
    loadImage,
    buildDocument,
    applyOperations,
  }
})
