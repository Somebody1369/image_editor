<script setup lang="ts">
/**
 * The preview. Draws only the cropped region of the immutable source onto a canvas
 * (downscaled for speed); the colour transform is applied on top by the SVG
 * <filter> via CSS. So a redraw happens only when the source or crop changes —
 * tone/filter changes are handled live by the filter graph.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import { compileSvgPrimitives } from '../core/filter'
import { renderToCanvas } from '../core/renderer'

const PREVIEW_MAX = 1600

const emit = defineEmits<{ upload: []; sample: [] }>()

const store = useEditorStore()
const { original, previewOperations } = storeToRefs(store)
const canvasEl = ref<HTMLCanvasElement | null>(null)

function cropKey(): string {
  const c = previewOperations.value.find((o) => o.type === 'crop')
  return c ? `${c.x},${c.y},${c.width},${c.height}` : 'full'
}

function draw(): void {
  const canvas = canvasEl.value
  const src = original.value
  if (!canvas || !src) return
  renderToCanvas(src, previewOperations.value, canvas, { maxSize: PREVIEW_MAX, bakeFilter: false })
}

const filterCss = computed(() =>
  compileSvgPrimitives(previewOperations.value).length ? 'url(#editorFilter)' : 'none',
)

watch([original, cropKey], draw)
onMounted(draw)
</script>

<template>
  <div class="stage-inner">
    <canvas
      v-show="original"
      ref="canvasEl"
      class="preview-canvas"
      :style="{ filter: filterCss }"
    />
    <div v-if="!original" class="empty-state text-medium-emphasis">
      <v-icon size="52" icon="mdi-image-outline" class="mb-2" />
      <div class="text-body-1">No image loaded</div>
      <div class="text-caption mb-4">Drop an image here, upload one, or load the sample.</div>
      <div class="d-flex ga-2">
        <v-btn color="primary" prepend-icon="mdi-upload" @click="emit('upload')">Upload image</v-btn>
        <v-btn variant="tonal" prepend-icon="mdi-image-multiple" @click="emit('sample')">
          Load sample
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-inner {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 12px;
}
.preview-canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 6px 30px rgba(0, 0, 0, 0.35);
  background-color: rgb(var(--v-theme-surface-bright));
  background-image:
    linear-gradient(45deg, rgba(var(--v-theme-on-surface), 0.06) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(var(--v-theme-on-surface), 0.06) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(var(--v-theme-on-surface), 0.06) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(var(--v-theme-on-surface), 0.06) 75%);
  background-size: 22px 22px;
  background-position: 0 0, 0 11px, 11px -11px, -11px 0;
}
.empty-state {
  margin: auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
</style>
