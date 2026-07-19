import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { vuetify } from './plugins/vuetify'
import App from './App.vue'
import { useEditorStore } from './stores/editor'
import './style.css'

const pinia = createPinia()
createApp(App).use(pinia).use(vuetify).mount('#app')

// Dev-only handle for manual/automated inspection; stripped from production builds.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__editor = useEditorStore(pinia)
}
