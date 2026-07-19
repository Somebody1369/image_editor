<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
import { useEditorStore } from './stores/editor'
import { useImageSource } from './composables/useImageSource'
import { useExport } from './composables/useExport'
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY } from './plugins/vuetify'
import AppSidebar from './components/AppSidebar.vue'
import ControlsPanel from './components/ControlsPanel.vue'
import EditorCanvas from './components/EditorCanvas.vue'
import SvgFilterDefs from './components/SvgFilterDefs.vue'

const store = useEditorStore()
const { loading, error, loadFile, upload, loadSample, importJson, clearError } = useImageSource()
const { exporting, exportImage } = useExport()

const { width } = useDisplay()
const isMobile = computed(() => width.value <= 760)
const drawerOpen = ref(false)
watch(isMobile, (mobile) => {
  if (!mobile) drawerOpen.value = false
})
function closeDrawer(): void {
  drawerOpen.value = false
}

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

function onDrop(event: DragEvent): void {
  const file = event.dataTransfer?.files?.[0]
  if (file) void loadFile(file)
}
</script>

<template>
  <v-app>
    <SvgFilterDefs />

    <div class="shell" :class="{ 'shell--mobile': isMobile }">
      <aside class="sidebar" :class="{ 'sidebar--open': isMobile && drawerOpen }">
        <AppSidebar
          :upload="upload"
          :load-sample="loadSample"
          :import-json="importJson"
          :loading="loading"
          @navigate="closeDrawer"
        />

        <ControlsPanel v-if="!isMobile" />

        <!-- Session actions live in the drawer on mobile (top bar stays minimal). -->
        <div v-if="isMobile" class="drawer-actions pa-3">
          <v-divider class="mb-3" />
          <div class="d-flex align-center ga-2">
            <v-btn
              icon="mdi-undo"
              size="small"
              variant="tonal"
              :disabled="!store.canUndo"
              aria-label="Undo"
              @click="store.undo()"
            />
            <v-btn
              icon="mdi-redo"
              size="small"
              variant="tonal"
              :disabled="!store.canRedo"
              aria-label="Redo"
              @click="store.redo()"
            />
            <v-btn
              variant="tonal"
              size="small"
              prepend-icon="mdi-backup-restore"
              :disabled="!store.hasEdits"
              @click="store.reset()"
            >
              Reset
            </v-btn>
            <v-spacer />
            <v-btn
              :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
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
            icon="mdi-menu"
            size="small"
            variant="text"
            aria-label="Open menu"
            @click="drawerOpen = !drawerOpen"
          />
          <span v-if="store.isLoaded" class="text-body-2 font-weight-medium text-truncate">
            {{ store.sourceMeta?.name }}
          </span>
          <span v-else class="text-body-2 text-medium-emphasis">No image</span>

          <v-spacer />

          <template v-if="!isMobile">
            <v-btn
              icon="mdi-undo"
              size="small"
              variant="text"
              :disabled="!store.canUndo"
              aria-label="Undo"
              @click="store.undo()"
            />
            <v-btn
              icon="mdi-redo"
              size="small"
              variant="text"
              :disabled="!store.canRedo"
              aria-label="Redo"
              @click="store.redo()"
            />
            <v-btn
              icon="mdi-backup-restore"
              size="small"
              variant="text"
              :disabled="!store.hasEdits"
              aria-label="Reset all edits"
              @click="store.reset()"
            />
            <v-btn
              :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
              size="small"
              variant="text"
              :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
              @click="toggleTheme"
            />
          </template>

          <v-btn
            color="primary"
            class="ms-2"
            prepend-icon="mdi-tray-arrow-down"
            :disabled="!store.isLoaded"
            :loading="exporting"
            @click="exportImage"
          >
            Export
          </v-btn>
        </header>

        <main class="canvas-area" @dragover.prevent @drop.prevent="onDrop">
          <EditorCanvas @upload="upload" @sample="loadSample" />
        </main>

        <ControlsPanel v-if="isMobile" class="mobile-controls" />
      </div>
    </div>

    <v-snackbar :model-value="!!error" color="error" timeout="4000" @update:model-value="clearError">
      {{ error }}
    </v-snackbar>
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
