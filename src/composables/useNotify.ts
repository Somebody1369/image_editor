/**
 * One home for the app's user-facing notifications (error + advisory notice), shared by
 * every source/export action so the two snackbars in App.vue have a single source of
 * truth. Kept separate from the per-action progress flags (`loading`, `exporting`),
 * which stay local to their own composables.
 *
 * Module-level singleton: this assumes a single client-side app instance (no SSR).
 */
import { ref } from 'vue'

const error = ref<string | null>(null)
const notice = ref<string | null>(null)

export function useNotify() {
  return {
    error,
    notice,
    setError: (message: string): void => {
      error.value = message
    },
    setNotice: (message: string): void => {
      notice.value = message
    },
    clearError: (): void => {
      error.value = null
    },
    clearNotice: (): void => {
      notice.value = null
    },
  }
}
