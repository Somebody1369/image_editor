<script setup lang="ts">
/**
 * Live tone sliders. Each drag is one undo step: `beginChange()` snapshots on
 * pointer-down (@start), then every move calls `updateAdjust()` (no snapshot). Reset
 * buttons use the committed `setAdjust()`. The preview updates in real time through
 * the SVG filter — no canvas redraw.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import { isNeutralAdjust } from '../core/operations'

type AdjustKey = 'brightness' | 'contrast' | 'saturation'

const store = useEditorStore()
const { adjust } = storeToRefs(store)

const rows: { key: AdjustKey; label: string; icon: string }[] = [
  { key: 'brightness', label: 'Brightness', icon: 'mdi-brightness-6' },
  { key: 'contrast', label: 'Contrast', icon: 'mdi-contrast-circle' },
  { key: 'saturation', label: 'Saturation', icon: 'mdi-palette-outline' },
]

const isNeutral = computed(() => isNeutralAdjust(adjust.value))

const format = (v: number): string => (v > 0 ? `+${v}` : `${v}`)

// Keyboard parity with the pointer drag: arrow/Home/End/PageUp/Down keys change the
// value without firing @start. We arm a gesture on key-down and take the history
// snapshot LAZILY, on the first move that actually changes the value — so a key
// press at the slider's limit (no change fires) never creates an empty undo step or
// wipes the redo stack, and auto-repeat coalesces into a single undo step.
const VALUE_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])
let keyGestureArmed = false
let keyGestureSnapshotted = false

function onInput(key: AdjustKey, value: number): void {
  if (keyGestureArmed && !keyGestureSnapshotted) {
    store.beginChange()
    keyGestureSnapshotted = true
  }
  store.updateAdjust({ [key]: value })
}

function onKeydown(event: KeyboardEvent): void {
  if (VALUE_KEYS.has(event.key)) keyGestureArmed = true
}
function endKeying(event?: KeyboardEvent): void {
  if (event && !VALUE_KEYS.has(event.key)) return
  keyGestureArmed = false
  keyGestureSnapshotted = false
}

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
        prepend-icon="mdi-restore"
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
        @start="store.beginChange()"
        @keydown="onKeydown"
        @keyup="endKeying"
        @blur="endKeying()"
        @update:model-value="onInput(row.key, $event)"
      >
        <template #append>
          <v-btn
            icon="mdi-restore"
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
