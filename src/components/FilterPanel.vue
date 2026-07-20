<script setup lang="ts">
/** Creative filter as a single-choice segmented control (None / Greyscale / Sepia). */
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import type { FilterName } from '../core/operations'

const store = useEditorStore()
const { filterName } = storeToRefs(store)

const options: { label: string; value: FilterName | null }[] = [
  { label: 'None', value: null },
  { label: 'Greyscale', value: 'greyscale' },
  { label: 'Sepia', value: 'sepia' },
]

function select(value: FilterName | null): void {
  if (value === filterName.value) return
  store.commit(() => store.setFilter(value))
}
</script>

<template>
  <div class="pa-4">
    <div class="text-overline text-medium-emphasis mb-2">Filter</div>
    <v-btn-toggle :model-value="filterName" mandatory divided density="comfortable" class="w-100">
      <v-btn
        v-for="o in options"
        :key="String(o.value)"
        :value="o.value"
        size="small"
        class="flex-grow-1 text-none"
        @click="select(o.value)"
      >
        {{ o.label }}
      </v-btn>
    </v-btn-toggle>
  </div>
</template>
