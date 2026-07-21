import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Deuda técnica (HU-42/HU-44 tocarán estas pantallas): el patrón actual de
      // setLoading/setState síncrono en effects dispara esta regla nueva de
      // react-hooks v6. Se degrada a warning hasta refactorizar los data-fetch.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
