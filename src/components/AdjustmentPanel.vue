<script setup lang="ts">
/**
 * Live tone sliders. History bookkeeping (one undo step per drag / key-run, no empty
 * steps) lives in `useAdjustGesture`; this component only wires slider events to it.
 * The preview updates in real time through the SVG filter — no canvas redraw.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { mdiBrightness6, mdiContrastCircle, mdiPaletteOutline, mdiRestore } from '@mdi/js'
import { useEditorStore } from '../stores/editor'
import { useAdjustGesture } from '../composables/useAdjustGesture'
import { isNeutralAdjust } from '../core/operations'

type AdjustKey = 'brightness' | 'contrast' | 'saturation'

const store = useEditorStore()
const { adjust } = storeToRefs(store)
const gesture = useAdjustGesture()

const rows: { key: AdjustKey; label: string; icon: string }[] = [
  { key: 'brightness', label: 'Brightness', icon: mdiBrightness6 },
  { key: 'contrast', label: 'Contrast', icon: mdiContrastCircle },
  { key: 'saturation', label: 'Saturation', icon: mdiPaletteOutline },
]

const isNeutral = computed(() => isNeutralAdjust(adjust.value))

const format = (v: number): string => (v > 0 ? `+${v}` : `${v}`)

function resetOne(key: AdjustKey): void {
  if (adjust.value[key] === 0) return
  store.setAdjust({ [key]: 0 })
}

function resetAll(): void {
  if (isNeutral.value) return
  store.setAdjust({ brightness: 0, contrast: 0, saturation: 0 })
}
</script>

<template>
  <div class="pa-4">
    <div class="d-flex align-center justify-space-between mb-2">
      <span class="text-overline text-medium-emphasis">Adjustments</span>
      <v-btn
        size="x-small"
        variant="text"
        :prepend-icon="mdiRestore"
        :disabled="isNeutral"
        @click="resetAll"
      >
        Reset all
      </v-btn>
    </div>

    <div v-for="row in rows" :key="row.key" class="mb-2">
      <div class="d-flex align-center text-body-2 mb-1">
        <v-icon :icon="row.icon" size="18" class="me-2" />
        <span>{{ row.label }}:</span>
        <span class="ms-1 text-medium-emphasis" style="font-variant-numeric: tabular-nums">
          {{ format(adjust[row.key]) }}
        </span>
      </div>
      <v-slider
        :model-value="adjust[row.key]"
        :min="-100"
        :max="100"
        :step="1"
        :aria-label="row.label"
        @start="gesture.pointerStart()"
        @end="gesture.end()"
        @keydown="gesture.keydown($event)"
        @keyup="gesture.keyup($event)"
        @blur="gesture.keyup()"
        @update:model-value="gesture.apply(row.key, $event)"
      >
        <template #append>
          <v-btn
            :icon="mdiRestore"
            size="x-small"
            variant="text"
            :disabled="adjust[row.key] === 0"
            :aria-label="`Reset ${row.label.toLowerCase()}`"
            @click="resetOne(row.key)"
          />
        </template>
      </v-slider>
    </div>
  </div>
</template>
