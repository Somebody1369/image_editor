<script setup lang="ts">
/** The right-hand control column: adjustments, filter, and hold-to-compare. */
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import AdjustmentPanel from './AdjustmentPanel.vue'
import FilterPanel from './FilterPanel.vue'
import CropTool from './CropTool.vue'

const store = useEditorStore()
const { isLoaded, sourceMeta } = storeToRefs(store)
</script>

<template>
  <div v-if="isLoaded" class="controls">
    <div v-if="sourceMeta" class="px-4 pt-4 pb-1">
      <div class="text-body-2 text-truncate">{{ sourceMeta.name }}</div>
      <div class="text-caption text-medium-emphasis">
        {{ sourceMeta.width }} × {{ sourceMeta.height }} px
      </div>
    </div>
    <v-divider />

    <div class="pa-4"><CropTool /></div>
    <v-divider />

    <AdjustmentPanel />
    <v-divider />
    <FilterPanel />
    <v-divider />

    <div class="pa-4">
      <v-btn
        block
        variant="tonal"
        prepend-icon="mdi-compare"
        aria-label="Hold to view the original image"
        @pointerdown="store.setViewOriginal(true)"
        @pointerup="store.setViewOriginal(false)"
        @pointerleave="store.setViewOriginal(false)"
        @pointercancel="store.setViewOriginal(false)"
      >
        Hold to view original
      </v-btn>
    </div>
  </div>

  <div v-else class="pa-4 text-medium-emphasis text-caption">
    Load an image to start editing.
  </div>
</template>
