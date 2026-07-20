/**
 * Vue-facing glue over the image utilities and the store. Keeps loading state and
 * error messages in one place so the app bar, the empty state and drag-and-drop all
 * share them.
 */
import { ref } from 'vue'
import { useEditorStore } from '../stores/editor'
import {
  createSampleImage,
  loadImageFile,
  loadImageFromDataUrl,
  pickImageFile,
  pickJsonFile,
} from '../utils/image'
import type { EditDocument } from '../core/document'
import { parseDocument } from '../core/document'

// Module-level singleton: loading/error/notice are shared across every call site (the
// app bar, the sidebar, drag-and-drop), so the state stays in sync without prop-drilling.
const loading = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

export function useImageSource() {
  const store = useEditorStore()

  async function loadFile(file: File): Promise<void> {
    loading.value = true
    error.value = null
    try {
      store.loadImage(await loadImageFile(file))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load image.'
    } finally {
      loading.value = false
    }
  }

  async function upload(): Promise<void> {
    const file = await pickImageFile()
    if (file) await loadFile(file)
  }

  function loadSample(): void {
    error.value = null
    store.loadImage(createSampleImage())
  }

  /**
   * Replay a JSON document. If it embeds the original, the whole result is
   * reproduced in one step; otherwise the operations are applied onto the currently
   * loaded image (matching the brief's "alongside the image" thin form).
   */
  async function importJson(): Promise<void> {
    const file = await pickJsonFile()
    if (!file) return
    loading.value = true
    error.value = null
    notice.value = null
    try {
      const doc = parseDocument(await file.text())
      if (doc.embeddedSource) {
        store.loadImage(await loadImageFromDataUrl(doc.embeddedSource, doc.source.name))
        store.applyOperations(doc.operations)
      } else if (store.isLoaded) {
        warnOnSizeMismatch(doc)
        store.applyOperations(doc.operations)
      } else {
        error.value = 'This JSON has no embedded image — load the original first, then import.'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Could not import document.'
    } finally {
      loading.value = false
    }
  }

  /**
   * A crop is stored in the original's pixels, so replaying a thin document onto a
   * differently-sized image would clamp it to something meaningless. It still applies
   * (adjust/filter are size-independent), but warn so the mismatch isn't silent.
   */
  function warnOnSizeMismatch(doc: EditDocument): void {
    const cur = store.sourceMeta
    const hasCrop = doc.operations.some((o) => o.type === 'crop')
    if (hasCrop && cur && (cur.width !== doc.source.width || cur.height !== doc.source.height)) {
      notice.value =
        `These edits were made for a ${doc.source.width}×${doc.source.height} image; ` +
        `the crop may not match the current ${cur.width}×${cur.height} image.`
    }
  }

  function clearError(): void {
    error.value = null
  }
  function clearNotice(): void {
    notice.value = null
  }

  return {
    loading,
    error,
    notice,
    loadFile,
    upload,
    loadSample,
    importJson,
    clearError,
    clearNotice,
  }
}
