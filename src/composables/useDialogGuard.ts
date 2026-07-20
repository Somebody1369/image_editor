/**
 * Tracks how many blocking (modal) dialogs are open, as reactive app state.
 *
 * The global undo/redo shortcut uses `hasOpenDialog` to avoid mutating edits behind a
 * modal (e.g. the crop dialog, whose cropper is seeded once and wouldn't reflect an
 * undo happening under it) — a reactive flag instead of querying Vuetify's private
 * `.v-overlay--active` DOM classes, which are not a stable public API.
 */
import { computed, getCurrentScope, onScopeDispose, watch, type Ref } from 'vue'
import { ref } from 'vue'

const openCount = ref(0)

/** True while at least one registered dialog is open. */
export const hasOpenDialog = computed(() => openCount.value > 0)

/** Make a dialog's `open` ref contribute to `hasOpenDialog`; auto-cleans on dispose. */
export function registerDialog(open: Ref<boolean>): void {
  let counted = false
  const set = (isOpen: boolean): void => {
    if (isOpen === counted) return
    openCount.value += isOpen ? 1 : -1
    counted = isOpen
  }
  watch(open, set, { immediate: true })
  if (getCurrentScope()) onScopeDispose(() => set(false))
}
