<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
import {
  mdiBackupRestore,
  mdiMenu,
  mdiRedo,
  mdiTrayArrowDown,
  mdiUndo,
  mdiWeatherNight,
  mdiWeatherSunny,
} from '@mdi/js'
import { useEditorStore } from './stores/editor'
import { useImageSource } from './composables/useImageSource'
import { useExport } from './composables/useExport'
import { hasOpenDialog } from './composables/useDialogGuard'
import { isAdjustGestureActive } from './composables/useAdjustGesture'
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY } from './plugins/vuetify'
import AppSidebar from './components/AppSidebar.vue'
import ControlsPanel from './components/ControlsPanel.vue'
import EditorCanvas from './components/EditorCanvas.vue'
import SvgFilterDefs from './components/SvgFilterDefs.vue'

const store = useEditorStore()
const { error, notice, loadFile, upload, loadSample, importJsonFile, clearError, clearNotice } =
  useImageSource()
const { exporting, exportImage } = useExport()

const { mobile: isMobile } = useDisplay()
const drawerOpen = ref(false)
watch(isMobile, (mobile) => {
  if (!mobile) drawerOpen.value = false
})
function closeDrawer(): void {
  drawerOpen.value = false
}

// The mobile drawer is a hand-rolled overlay, so it needs the dialog affordances a
// v-navigation-drawer would give for free: Esc to close, a focus trap, and focus
// save/restore. Wired here rather than in the template to keep the markup readable.
const drawerEl = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

function drawerFocusables(): HTMLElement[] {
  const el = drawerEl.value
  if (!el) return []
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(el.querySelectorAll<HTMLElement>(selector)).filter(
    (n) => n.offsetParent !== null,
  )
}

function onDrawerKeydown(event: KeyboardEvent): void {
  if (!drawerOpen.value) return
  if (event.key === 'Escape') {
    drawerOpen.value = false
    return
  }
  if (event.key !== 'Tab') return
  const items = drawerFocusables()
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(drawerOpen, async (open) => {
  if (!isMobile.value) return
  if (open) {
    lastFocused = document.activeElement as HTMLElement | null
    await nextTick()
    drawerFocusables()[0]?.focus()
  } else if (lastFocused) {
    lastFocused.focus()
    lastFocused = null
  }
})

// Editor keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = redo.
function onKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey)) return
  // Don't mutate edits behind an open modal dialog (the crop modal is seeded once and
  // wouldn't reflect an undo under it) or mid-slider-gesture (an undo would desync the
  // drag's baseline) — both tracked as reactive state, not by probing the DOM.
  if (hasOpenDialog.value || isAdjustGestureActive.value) return
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey) {
    event.preventDefault()
    store.undo()
  } else if ((key === 'z' && event.shiftKey) || key === 'y') {
    event.preventDefault()
    store.redo()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)
function toggleTheme(): void {
  const next = isDark.value ? LIGHT_THEME : DARK_THEME
  theme.global.name.value = next
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    /* ignore storage failures (private mode) */
  }
}

// Drag-and-drop: highlight the drop zone while a file is over it, and route a dropped
// .edits.json to the import path (not the image loader, which would reject it).
const isDraggingFile = ref(false)

function onDragEnter(): void {
  isDraggingFile.value = true
}
function onDragLeave(event: DragEvent): void {
  const target = event.currentTarget
  // Ignore leave events fired as the pointer moves between child elements.
  if (
    target instanceof Node &&
    event.relatedTarget instanceof Node &&
    target.contains(event.relatedTarget)
  ) {
    return
  }
  isDraggingFile.value = false
}
function onDrop(event: DragEvent): void {
  isDraggingFile.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')
  void (isJson ? importJsonFile(file) : loadFile(file))
}
</script>

<template>
  <v-app>
    <SvgFilterDefs />

    <div class="shell" :class="{ 'shell--mobile': isMobile }">
      <aside
        id="app-drawer"
        ref="drawerEl"
        class="sidebar"
        :class="{ 'sidebar--open': isMobile && drawerOpen }"
        :role="isMobile && drawerOpen ? 'dialog' : undefined"
        :aria-modal="isMobile && drawerOpen ? 'true' : undefined"
        :aria-label="isMobile && drawerOpen ? 'Menu' : undefined"
        :inert="isMobile && !drawerOpen"
        @keydown="onDrawerKeydown"
      >
        <AppSidebar @navigate="closeDrawer" />

        <ControlsPanel v-if="!isMobile" />

        <!-- Session actions live in the drawer on mobile (top bar stays minimal). -->
        <div v-if="isMobile" class="drawer-actions pa-3">
          <v-divider class="mb-3" />
          <div class="d-flex align-center ga-2">
            <v-btn
              :icon="mdiUndo"
              size="small"
              variant="tonal"
              :disabled="!store.canUndo"
              aria-label="Undo"
              @click="store.undo()"
            />
            <v-btn
              :icon="mdiRedo"
              size="small"
              variant="tonal"
              :disabled="!store.canRedo"
              aria-label="Redo"
              @click="store.redo()"
            />
            <v-btn
              variant="tonal"
              size="small"
              :prepend-icon="mdiBackupRestore"
              :disabled="!store.hasEdits"
              @click="store.reset()"
            >
              Reset
            </v-btn>
            <v-spacer />
            <v-btn
              :icon="isDark ? mdiWeatherSunny : mdiWeatherNight"
              size="small"
              variant="tonal"
              :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
              @click="toggleTheme"
            />
          </div>
        </div>
      </aside>

      <div
        v-if="isMobile"
        class="scrim"
        :class="{ 'scrim--show': drawerOpen }"
        @click="drawerOpen = false"
      />

      <div class="workspace">
        <header class="topbar">
          <v-btn
            v-if="isMobile"
            :icon="mdiMenu"
            size="small"
            variant="text"
            aria-label="Open menu"
            aria-controls="app-drawer"
            :aria-expanded="drawerOpen"
            @click="drawerOpen = !drawerOpen"
          />
          <span v-if="store.isLoaded" class="text-body-2 font-weight-medium text-truncate">
            {{ store.sourceMeta?.name }}
          </span>
          <span v-else class="text-body-2 text-medium-emphasis">No image</span>

          <v-spacer />

          <template v-if="!isMobile">
            <v-btn
              :icon="mdiUndo"
              size="small"
              variant="text"
              :disabled="!store.canUndo"
              aria-label="Undo"
              @click="store.undo()"
            />
            <v-btn
              :icon="mdiRedo"
              size="small"
              variant="text"
              :disabled="!store.canRedo"
              aria-label="Redo"
              @click="store.redo()"
            />
            <v-btn
              :icon="mdiBackupRestore"
              size="small"
              variant="text"
              :disabled="!store.hasEdits"
              aria-label="Reset all edits"
              @click="store.reset()"
            />
            <v-btn
              :icon="isDark ? mdiWeatherSunny : mdiWeatherNight"
              size="small"
              variant="text"
              :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
              @click="toggleTheme"
            />
          </template>

          <v-btn
            color="primary"
            class="ms-2"
            :prepend-icon="mdiTrayArrowDown"
            :disabled="!store.isLoaded"
            :loading="exporting"
            @click="exportImage"
          >
            Export
          </v-btn>
        </header>

        <main
          class="canvas-area"
          :class="{ 'canvas-area--dragover': isDraggingFile }"
          @dragover.prevent
          @dragenter.prevent="onDragEnter"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop"
        >
          <EditorCanvas @upload="upload" @sample="loadSample" />
        </main>

        <ControlsPanel v-if="isMobile" class="mobile-controls" />
      </div>
    </div>

    <v-snackbar
      :model-value="!!error"
      color="error"
      timeout="4000"
      @update:model-value="clearError"
    >
      {{ error }}
    </v-snackbar>

    <v-snackbar
      :model-value="!!notice"
      color="info"
      timeout="6000"
      @update:model-value="clearNotice"
    >
      {{ notice }}
    </v-snackbar>

    <!-- Vuetify's snackbar announces politely (role="status"); mirror errors into an
         assertive live region so a failure interrupts assistive tech. -->
    <div class="visually-hidden" role="alert" aria-live="assertive">{{ error }}</div>
  </v-app>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.sidebar {
  width: 300px;
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.workspace {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  flex: 0 0 56px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgb(var(--v-theme-surface));
}
.canvas-area {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  transition: background 0.15s ease;
}
.canvas-area--dragover {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -10px;
  background: rgba(var(--v-theme-primary), 0.06);
}

/* Mobile: the sidebar becomes a slide-in drawer and the page scrolls. */
.shell--mobile {
  height: auto;
  min-height: 100dvh;
  overflow: visible;
}
.shell--mobile .sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  width: 86vw;
  max-width: 330px;
  flex: none;
  transform: translateX(-100%);
  transition: transform 0.25s ease;
  z-index: 1000;
  box-shadow: 4px 0 30px rgba(0, 0, 0, 0.4);
}
.shell--mobile .sidebar.sidebar--open {
  transform: translateX(0);
}
.shell--mobile .canvas-area {
  min-height: 48vh;
}
.scrim {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.scrim--show {
  opacity: 1;
  pointer-events: auto;
}
.mobile-controls {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
