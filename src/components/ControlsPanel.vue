<script setup lang="ts">
/** The right-hand control column: adjustments. */
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import AdjustmentPanel from './AdjustmentPanel.vue'

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

    <AdjustmentPanel />
  </div>

  <div v-else class="pa-4 text-medium-emphasis text-caption">
    Load an image to start editing.
  </div>
</template>
