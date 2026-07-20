<script setup lang="ts">
/**
 * Crop UI. cropperjs is used only as the crop *interface*: on Apply we read the crop
 * rectangle in the original's natural pixels (`getData(true)`) and store it as a
 * `crop` operation. The renderer does the actual cropping, so the op-model stays the
 * single source of truth and the crop replays on the full-resolution original.
 */
import { nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { mdiCrop, mdiCropFree, mdiCropRotate } from '@mdi/js'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const { sourceDataUrl, crop } = storeToRefs(store)

const open = ref(false)
const imgEl = ref<HTMLImageElement | null>(null)
let cropper: Cropper | null = null

const presets: { label: string; value: number }[] = [
  { label: 'Free', value: Number.NaN },
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '4:5', value: 4 / 5 },
  { label: '16:9', value: 16 / 9 },
  { label: 'A4', value: 210 / 297 },
]
const activePreset = ref(0)

/** Index of the aspect preset matching a rectangle's ratio (0 = Free if none). */
function presetForRect(rect: { width: number; height: number }): number {
  const ratio = rect.width / rect.height
  const i = presets.findIndex((p) => Number.isFinite(p.value) && Math.abs(p.value - ratio) < 0.01)
  return i === -1 ? 0 : i
}

function destroy(): void {
  cropper?.destroy()
  cropper = null
}

async function init(): Promise<void> {
  await nextTick()
  const el = imgEl.value
  if (!el) return
  destroy()
  cropper = new Cropper(el, {
    viewMode: 1,
    autoCropArea: 1,
    background: false,
    ready() {
      const c = crop.value
      if (!c) return
      cropper?.setData({ x: c.x, y: c.y, width: c.width, height: c.height })
      // Reflect the saved crop's aspect in the chip group when it matches a preset.
      const i = presetForRect(c)
      if (i > 0) setPreset(i)
    },
  })
}

watch(open, (isOpen) => {
  if (isOpen) void init()
  else destroy()
})

function setPreset(index: number): void {
  const preset = presets[index]
  if (!preset) return
  activePreset.value = index
  cropper?.setAspectRatio(preset.value)
}

function apply(): void {
  if (cropper) {
    const d = cropper.getData(true)
    store.setCrop({ x: d.x, y: d.y, width: d.width, height: d.height })
  }
  open.value = false
}

function clearCrop(): void {
  store.setCrop(null)
  open.value = false
}
</script>

<template>
  <v-btn
    block
    variant="tonal"
    :prepend-icon="crop ? mdiCropRotate : mdiCrop"
    :color="crop ? 'primary' : undefined"
    @click="open = true"
  >
    {{ crop ? 'Cropped — edit' : 'Crop' }}
  </v-btn>

  <v-dialog v-model="open" max-width="1040" scrollable>
    <v-card>
      <v-toolbar density="comfortable" color="surface" flat>
        <v-toolbar-title class="text-body-1">Crop</v-toolbar-title>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" class="mx-2" @click="apply">Apply</v-btn>
      </v-toolbar>

      <div class="crop-stage">
        <img ref="imgEl" :src="sourceDataUrl ?? ''" alt="Crop source" class="crop-img" />
      </div>

      <v-card-actions class="crop-tools px-4">
        <span class="text-caption text-medium-emphasis me-2">Aspect</span>
        <v-chip-group :model-value="activePreset" mandatory selected-class="text-primary">
          <v-chip v-for="(p, i) in presets" :key="p.label" size="small" @click="setPreset(i)">
            {{ p.label }}
          </v-chip>
        </v-chip-group>
        <v-spacer />
        <v-btn variant="text" size="small" :prepend-icon="mdiCropFree" @click="clearCrop">
          Clear crop
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.crop-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0e0f13;
  padding: 12px;
  max-height: 64vh;
  overflow: hidden;
}
.crop-img {
  display: block;
  max-width: 100%;
  max-height: 60vh;
}
.crop-tools {
  flex-wrap: wrap;
}
</style>
