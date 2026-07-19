import { defineConfig } from 'vitest/config'

// Unit tests cover the pure core (op-model, filter compilers, document) and the
// Pinia store — all framework-light, so a plain node environment is enough and we
// avoid pulling the Vue plugin (which would clash with Vite 8's rolldown types).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
