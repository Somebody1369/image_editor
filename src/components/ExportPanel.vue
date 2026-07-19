<script setup lang="ts">
/**
 * Export section. Format / quality / embed are stored, so the top-bar "Export"
 * button and these controls share one source of truth. The image is baked at full
 * resolution from the same op-model that drives the preview.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import { useExport } from '../composables/useExport'

const store = useEditorStore()
const { exportFormat, exportQuality, embedOriginal } = storeToRefs(store)
const { exporting, exportImage, exportJson } = useExport()

const isJpeg = computed(() => exportFormat.value === 'image/jpeg')
</script>

<template>
  <div class="pa-4">
    <div class="text-overline text-medium-emphasis mb-2">Export</div>

    <v-btn-toggle v-model="exportFormat" mandatory divided density="comfortable" class="w-100 mb-3">
      <v-btn value="image/png" size="small" class="flex-grow-1 text-none">PNG</v-btn>
      <v-btn value="image/jpeg" size="small" class="flex-grow-1 text-none">JPEG</v-btn>
    </v-btn-toggle>

    <div v-if="isJpeg" class="mb-2">
      <div class="d-flex justify-space-between text-caption text-medium-emphasis">
        <span>Quality</span><span>{{ exportQuality }}%</span>
      </div>
      <v-slider v-model="exportQuality" :min="40" :max="100" :step="1" aria-label="JPEG quality" />
    </div>

    <v-btn
      block
      color="primary"
      prepend-icon="mdi-download"
      :loading="exporting"
      class="mb-4"
      @click="exportImage"
    >
      Export image
    </v-btn>

    <v-switch
      v-model="embedOriginal"
      density="compact"
      hide-details
      color="primary"
      label="Embed original in JSON"
    />
    <v-btn block variant="tonal" prepend-icon="mdi-code-json" @click="exportJson">
      Export operations (JSON)
    </v-btn>
  </div>
</template>
