import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  // autoImport tree-shakes Vuetify: only components/directives actually used in
  // templates are bundled, instead of registering the whole library.
  plugins: [vue(), vuetify({ autoImport: true })],
  server: { port: Number(process.env.PORT) || 5173 },
})
