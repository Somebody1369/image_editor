<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { useEditorStore } from './stores/editor'
import { useImageSource } from './composables/useImageSource'
import { DARK_THEME, LIGHT_THEME, THEME_STORAGE_KEY } from './plugins/vuetify'
import AppSidebar from './components/AppSidebar.vue'
import EditorCanvas from './components/EditorCanvas.vue'
import SvgFilterDefs from './components/SvgFilterDefs.vue'

const store = useEditorStore()
const { loading, error, loadFile, upload, loadSample, importJson, clearError } = useImageSource()

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

    <div class="shell">
      <AppSidebar
        :upload="upload"
        :load-sample="loadSample"
        :import-json="importJson"
        :loading="loading"
      />

      <div class="workspace">
        <header class="topbar">
          <span
            v-if="store.isLoaded"
            class="text-body-2 font-weight-medium text-truncate"
          >
            {{ store.sourceMeta?.name }}
          </span>
          <span v-else class="text-body-2 text-medium-emphasis">No image</span>

          <v-spacer />

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
        </header>

        <main class="canvas-area" @dragover.prevent @drop.prevent="onDrop">
          <EditorCanvas @upload="upload" @sample="loadSample" />
        </main>
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

@media (max-width: 760px) {
  .shell {
    height: auto;
    min-height: 100vh;
    flex-direction: column;
    overflow: visible;
  }
  .workspace {
    order: 1;
  }
  .canvas-area {
    min-height: 52vh;
  }
}
</style>
