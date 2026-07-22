import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Modo E2E (Playwright): con VITE_E2E=1, @clerk/react se sustituye por un
// stub local con sesión en localStorage (src/lib/clerkStub.tsx). El bundle
// normal no se ve afectado — el alias solo existe bajo el flag.
const e2eAlias: Record<string, string> = {}
if (process.env.VITE_E2E === '1') {
  e2eAlias['@clerk/react'] = fileURLToPath(new URL('./src/lib/clerkStub.tsx', import.meta.url))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: e2eAlias,
  },
  preview: {
    allowedHosts: true,
  },
})
