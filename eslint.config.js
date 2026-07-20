import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

// Flat config: JS + TypeScript (type-aware config left off for speed) + Vue essential
// correctness rules. Prettier is placed last so it disables any formatting rules that
// would fight the formatter — ESLint owns correctness, Prettier owns layout.
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
    // <script setup> blocks are TypeScript, so vue-tsc already checks for undefined
    // identifiers; ESLint's core no-undef only false-positives on browser globals here
    // (as it does for .ts, where typescript-eslint disables it).
    rules: { 'no-undef': 'off' },
  },
  prettier,
)
