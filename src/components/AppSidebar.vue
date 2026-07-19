<script setup lang="ts">
/** Framer-style left sidebar: brand, a "Source" group, then the control sections. */
import { useEditorStore } from '../stores/editor'
import ControlsPanel from './ControlsPanel.vue'

const store = useEditorStore()

defineProps<{
  upload: () => void
  loadSample: () => void
  importJson: () => void
  loading?: boolean
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">
        <v-icon icon="mdi-image-edit-outline" size="20" />
      </div>
      <div class="brand-text">
        <div class="brand-title">Image Editor</div>
        <div class="brand-sub text-medium-emphasis">Non-destructive</div>
      </div>
    </div>

    <div class="sidebar-scroll">
      <div class="group">
        <div class="group-title text-medium-emphasis">Source</div>
        <v-btn
          block
          variant="text"
          class="nav-btn justify-start"
          :loading="loading"
          prepend-icon="mdi-tray-arrow-up"
          @click="upload"
        >
          Upload image
        </v-btn>
        <v-btn
          block
          variant="text"
          class="nav-btn justify-start"
          prepend-icon="mdi-image-multiple-outline"
          @click="loadSample"
        >
          Load sample
        </v-btn>
        <v-btn
          block
          variant="text"
          class="nav-btn justify-start"
          prepend-icon="mdi-code-json"
          @click="importJson"
        >
          Import JSON
        </v-btn>
        <v-btn
          v-if="store.isLoaded"
          block
          variant="text"
          class="nav-btn justify-start"
          prepend-icon="mdi-image-remove-outline"
          @click="store.removeImage()"
        >
          Remove image
        </v-btn>
      </div>

      <v-divider />

      <ControlsPanel />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 300px;
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(150deg, #2dd4bf, #0d9488);
}
.brand-title {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.1;
}
.brand-sub {
  font-size: 0.75rem;
}
.sidebar-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.group {
  padding: 12px 12px 8px;
}
.group-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 4px 8px 6px;
}
.nav-btn {
  text-transform: none;
  letter-spacing: normal;
  font-weight: 400;
  height: 38px;
}

@media (max-width: 760px) {
  .sidebar {
    width: auto;
    flex: 0 0 auto;
    order: 2;
    border-right: none;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  }
  .sidebar-scroll {
    overflow-y: visible;
  }
}
</style>
