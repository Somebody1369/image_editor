<script setup lang="ts">
/**
 * Brand + "Source" navigation. Rendered inside the persistent sidebar on desktop,
 * and inside the slide-in drawer on mobile. Emits `navigate` after an action so the
 * mobile drawer can close.
 */
import {
  mdiCodeJson,
  mdiImageEditOutline,
  mdiImageMultipleOutline,
  mdiImageRemoveOutline,
  mdiTrayArrowUp,
} from '@mdi/js'
import { useEditorStore } from '../stores/editor'
import { useImageSource } from '../composables/useImageSource'

const store = useEditorStore()
const emit = defineEmits<{ navigate: [] }>()

// Source actions come straight from the shared composable (singleton state), so no
// callbacks need to be threaded through props.
const { upload, loadSample, importJson, loading } = useImageSource()

function run(fn: () => void | Promise<void>): void {
  void fn()
  emit('navigate')
}
function removeImage(): void {
  store.removeImage()
  emit('navigate')
}
</script>

<template>
  <div class="sidebar-nav">
    <div class="brand">
      <div class="brand-mark">
        <v-icon :icon="mdiImageEditOutline" size="20" />
      </div>
      <div class="brand-text">
        <div class="brand-title">Image Editor</div>
        <div class="brand-sub text-medium-emphasis">Non-destructive</div>
      </div>
    </div>

    <div class="group">
      <div class="group-title text-medium-emphasis">Source</div>
      <v-btn
        block
        variant="text"
        class="nav-btn justify-start"
        :loading="loading"
        :prepend-icon="mdiTrayArrowUp"
        @click="run(upload)"
      >
        Upload image
      </v-btn>
      <v-btn
        block
        variant="text"
        class="nav-btn justify-start"
        :prepend-icon="mdiImageMultipleOutline"
        @click="run(loadSample)"
      >
        Load sample
      </v-btn>
      <v-btn
        block
        variant="text"
        class="nav-btn justify-start"
        :prepend-icon="mdiCodeJson"
        @click="run(importJson)"
      >
        Import JSON
      </v-btn>
      <v-btn
        v-if="store.isLoaded"
        block
        variant="text"
        class="nav-btn justify-start"
        :prepend-icon="mdiImageRemoveOutline"
        @click="removeImage"
      >
        Remove image
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
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
</style>
