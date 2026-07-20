/**
 * Export actions shared by the top-bar "Export" button and the export panel.
 * Settings (format / quality / embed) live in the store, so both entry points stay
 * in sync; the render + download happen here.
 */
import { ref } from 'vue'
import { useEditorStore } from '../stores/editor'
import { renderToBlob } from '../core/renderer'
import { serializeDocument } from '../core/document'
import { downloadBlob, downloadText } from '../utils/download'

// Module-level singleton: the top-bar Export button and the export panel share one
// `exporting` flag, so a bake started from either place shows the spinner on both.
const exporting = ref(false)

export function useExport() {
  const store = useEditorStore()

  const baseName = (): string => (store.sourceMeta?.name ?? 'image').replace(/\.[^.]+$/, '')

  async function exportImage(): Promise<void> {
    if (!store.original) return
    exporting.value = true
    try {
      const blob = await renderToBlob(
        store.original,
        store.operations,
        store.exportFormat,
        store.exportQuality / 100,
      )
      downloadBlob(
        blob,
        `${baseName()}-edited.${store.exportFormat === 'image/png' ? 'png' : 'jpg'}`,
      )
    } finally {
      exporting.value = false
    }
  }

  function exportJson(): void {
    downloadText(
      serializeDocument(store.buildDocument(store.embedOriginal)),
      `${baseName()}.edits.json`,
    )
  }

  return { exporting, exportImage, exportJson }
}
