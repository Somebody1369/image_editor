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
import { DocumentError, parseDocument } from '../core/document'
import { useNotify } from './useNotify'

// Module-level singleton: `loading` is shared across every call site (the app bar, the
// sidebar, drag-and-drop), so the state stays in sync without prop-drilling. The
// error/notice messages live in useNotify (shared with the export path).
const loading = ref(false)

export function useImageSource() {
  const store = useEditorStore()
  const { error, notice, clearError, clearNotice } = useNotify()

  async function loadFile(file: File): Promise<void> {
    loading.value = true
    error.value = null
    notice.value = null // a stale crop-mismatch notice shouldn't linger onto a new image
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
    notice.value = null
    store.loadImage(createSampleImage())
  }

  /**
   * Replay a JSON document. If it embeds the original, the whole result is
   * reproduced in one step; otherwise the operations are applied onto the currently
   * loaded image (matching the brief's "alongside the image" thin form).
   */
  /** Replay a JSON document from an already-obtained File (shared by the picker and drag-drop). */
  async function importJsonFile(file: File): Promise<void> {
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
      // A DocumentError carries a user-facing validation message; anything else is an
      // unexpected internal failure and shouldn't be blamed on the user's file.
      error.value = e instanceof DocumentError ? e.message : 'Could not import this document.'
    } finally {
      loading.value = false
    }
  }

  async function importJson(): Promise<void> {
    const file = await pickJsonFile()
    if (file) await importJsonFile(file)
  }

  /**
   * A crop is stored in the original's pixels, so replaying a thin document onto a
   * differently-sized image would clamp it to something meaningless. It still applies
   * (adjust/filter are size-independent), but warn so the mismatch isn't silent. Names
   * both images so the user can tell they loaded the wrong original.
   */
  function warnOnSizeMismatch(doc: EditDocument): void {
    const cur = store.sourceMeta
    const hasCrop = doc.operations.some((o) => o.type === 'crop')
    if (hasCrop && cur && (cur.width !== doc.source.width || cur.height !== doc.source.height)) {
      notice.value =
        `These edits target “${doc.source.name}” (${doc.source.width}×${doc.source.height}); ` +
        `the crop may not match the current “${cur.name}” (${cur.width}×${cur.height}).`
    }
  }

  return {
    loading,
    error,
    notice,
    loadFile,
    upload,
    loadSample,
    importJson,
    importJsonFile,
    clearError,
    clearNotice,
  }
}
