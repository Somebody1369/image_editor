<script setup lang="ts">
/**
 * The live, declarative colour transform. The op-model compiles to SVG <filter>
 * primitives and the preview canvas references this filter via CSS `filter: url()`.
 * Dragging a slider only updates these primitive attributes — no canvas redraw —
 * which is what makes the preview real-time. (LiveArt's stack is SVG-heavy, so the
 * edit pipeline is expressed natively as an SVG filter graph.)
 *
 * color-interpolation-filters="sRGB" matches the sRGB space of the canvas
 * `ctx.filter` export, so the preview and the exported pixels agree.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '../stores/editor'
import { compileSvgPrimitives } from '../core/filter'

const store = useEditorStore()
const { previewOperations } = storeToRefs(store)
const primitives = computed(() => compileSvgPrimitives(previewOperations.value))
</script>

<template>
  <svg class="visually-hidden" aria-hidden="true" width="0" height="0">
    <filter id="editorFilter" color-interpolation-filters="sRGB">
      <template v-for="(p, i) in primitives" :key="i">
        <feComponentTransfer v-if="p.kind === 'componentTransfer'">
          <feFuncR type="linear" :slope="p.slope" :intercept="p.intercept" />
          <feFuncG type="linear" :slope="p.slope" :intercept="p.intercept" />
          <feFuncB type="linear" :slope="p.slope" :intercept="p.intercept" />
        </feComponentTransfer>
        <feColorMatrix
          v-else-if="p.kind === 'saturate'"
          type="saturate"
          :values="String(p.value)"
        />
        <feColorMatrix v-else type="matrix" :values="p.values.join(' ')" />
      </template>
    </filter>
  </svg>
</template>
