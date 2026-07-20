import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

export const THEME_STORAGE_KEY = 'image-editor-theme'
export const DARK_THEME = 'framerDark'
export const LIGHT_THEME = 'framerLight'

function initialTheme(): string {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
  return stored === LIGHT_THEME || stored === DARK_THEME ? stored : DARK_THEME
}

// Framer-like app chrome: near-black neutral surfaces, hairline borders, a single
// blue accent for primary actions, restrained rounding.
export const vuetify = createVuetify({
  display: {
    // The layout switches to the slide-in drawer below this width; exposed through
    // useDisplay().mobile so components don't hard-code the breakpoint.
    mobileBreakpoint: 760,
  },
  theme: {
    defaultTheme: initialTheme(),
    themes: {
      [DARK_THEME]: {
        dark: true,
        colors: {
          background: '#0a0a0b',
          surface: '#101012',
          'surface-bright': '#1c1c20',
          'on-surface': '#ededee',
          'on-background': '#ededee',
          primary: '#22c9b4',
          'on-primary': '#04231f',
          secondary: '#8a8a90',
          error: '#e5484d',
        },
      },
      [LIGHT_THEME]: {
        dark: false,
        colors: {
          background: '#f4f4f5',
          surface: '#ffffff',
          'surface-bright': '#ececee',
          'on-surface': '#18181b',
          'on-background': '#18181b',
          primary: '#0d9488',
          'on-primary': '#ffffff',
          secondary: '#6e6e76',
          error: '#e5484d',
        },
      },
    },
  },
  defaults: {
    VBtn: { rounded: 'lg' },
    VSlider: { hideDetails: true, color: 'primary' },
    VCard: { rounded: 'lg' },
  },
})
